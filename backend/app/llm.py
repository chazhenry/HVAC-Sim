"""Chat-completion client for the tutor.

Tries the chosen model first, then each other configured provider (DeepSeek, then
OpenAI), and returns the first reply. Both speak the OpenAI chat-completions wire format. Keys are read
from the environment; `load_env_file` fills it from `backend/.env` for local
runs, and the deployed service gets the same variables from systemd.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

import httpx

ENV_FILE = Path(__file__).resolve().parent.parent / ".env"
TIMEOUT_SECONDS = 45.0
MAX_REPLY_TOKENS = 600


class LlmError(RuntimeError):
    """No provider produced a reply."""


class LlmNotConfigured(LlmError):
    """No API key is set for any provider."""


@dataclass(frozen=True)
class Provider:
    name: str
    url: str
    key: str
    model: str


def load_env_file(path: Path | None = None) -> None:
    """Read KEY=VALUE lines into the environment without overriding what is already set."""
    file = path or Path(os.environ.get("HVAC_SIM_ENV_FILE", ENV_FILE))
    if not file.is_file():
        return
    for raw in file.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.removeprefix("export ").strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        os.environ.setdefault(key, value)


# Providers in the order they are tried. Each lists its models in <NAME>_MODELS (comma separated) in
# backend/.env. Anthropic has no client here yet, so its models are listed but cannot be chosen.
PROVIDERS: dict[str, tuple[str, str, str | None]] = {
    "deepseek": ("DEEPSEEK_API_KEY", "DEEPSEEK_MODELS", "https://api.deepseek.com/chat/completions"),
    "openai": ("OPENAI_API_KEY", "OPENAI_MODELS", "https://api.openai.com/v1/chat/completions"),
    "anthropic": ("ANTHROPIC_API_KEY", "ANTHROPIC_MODELS", None),
}


@dataclass(frozen=True)
class ModelOption:
    """One model a user can pick, as "provider:model"."""
    id: str
    provider: str
    model: str
    available: bool
    reason: str | None = None


def listed_models(provider: str) -> list[str]:
    raw = os.environ.get(PROVIDERS[provider][1], "")
    return list(dict.fromkeys(m.strip() for m in raw.split(",") if m.strip()))


def model_options() -> list[ModelOption]:
    """Every model listed in the environment, marked unavailable when it cannot be used."""
    options: list[ModelOption] = []
    for name, (key_var, _, url) in PROVIDERS.items():
        has_key = bool(os.environ.get(key_var))
        reason = None if has_key and url else "no API key" if not has_key else "not supported yet"
        options += [ModelOption(f"{name}:{m}", name, m, reason is None, reason) for m in listed_models(name)]
    return options


def usable_model(model_id: str | None) -> bool:
    return any(o.id == model_id and o.available for o in model_options())


def providers(preferred: str | None = None) -> list[Provider]:
    """Configured providers, in the order they are tried. `preferred` ("provider:model", e.g. the
    system chatbot model) goes first with that model; the others stay as fallbacks."""
    # Without a choice, each provider uses the last (lightest) model in its list. A provider with
    # no key, no listed models or no client here is skipped.
    found: list[Provider] = []
    for name, (key_var, _, url) in PROVIDERS.items():
        key, listed = os.environ.get(key_var), listed_models(name)
        if key and listed and url:
            found.append(Provider(name, url, key, listed[-1]))
    if preferred and usable_model(preferred):
        name, _, model = preferred.partition(":")
        first = next((p for p in found if p.name == name), None)
        if first is not None:
            found = [Provider(first.name, first.url, first.key, model), *(p for p in found if p is not first)]
    return found


def default_model() -> str | None:
    """The model used when none is chosen: the first provider's, as "provider:model"."""
    first = next(iter(providers()), None)
    return f"{first.name}:{first.model}" if first else None


def _body(provider: Provider, messages: list[dict[str, str]]) -> dict[str, object]:
    if provider.name == "openai":
        # Current OpenAI models take max_completion_tokens (which also covers their reasoning) and
        # only the default temperature.
        return {"model": provider.model, "messages": messages, "max_completion_tokens": MAX_REPLY_TOKENS * 4}
    return {"model": provider.model, "messages": messages, "max_tokens": MAX_REPLY_TOKENS, "temperature": 0.4}


async def _ask(client: httpx.AsyncClient, provider: Provider, messages: list[dict[str, str]]) -> str:
    res = await client.post(
        provider.url,
        headers={"Authorization": f"Bearer {provider.key}"},
        json=_body(provider, messages),
    )
    res.raise_for_status()
    text = res.json()["choices"][0]["message"]["content"]
    if not isinstance(text, str) or not text.strip():
        raise ValueError("empty reply")
    return text.strip()


async def complete(messages: list[dict[str, str]], model: str | None = None) -> tuple[str, str]:
    """Return (reply, provider name). `model` ("provider:model") is tried first.
    Raises LlmError when every provider fails."""
    available = providers(model)
    if not available:
        raise LlmNotConfigured("No LLM API key is configured on the server.")
    problems: list[str] = []
    async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
        for provider in available:
            try:
                return await _ask(client, provider, messages), provider.name
            except httpx.HTTPStatusError as e:
                # Never echo the response body: it can repeat request details.
                problems.append(f"{provider.name}: HTTP {e.response.status_code}")
            except (httpx.HTTPError, KeyError, IndexError, ValueError, TypeError) as e:
                problems.append(f"{provider.name}: {type(e).__name__}")
    raise LlmError("; ".join(problems))
