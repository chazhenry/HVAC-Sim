"""Chat-completion client for the tutor.

Tries each configured provider in order (DeepSeek, then OpenAI) and returns the
first reply. Both speak the OpenAI chat-completions wire format. Keys are read
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


def providers() -> list[Provider]:
    """Configured providers, in the order they are tried."""
    env = os.environ.get
    found: list[Provider] = []
    if key := env("DEEPSEEK_API_KEY"):
        model = env("HVAC_SIM_DEEPSEEK_MODEL") or env("DEEPSEEK_FLASH") or env("DEEPSEEK_PRO") or "deepseek-chat"
        found.append(Provider("deepseek", "https://api.deepseek.com/chat/completions", key, model))
    if key := env("OPENAI_API_KEY"):
        model = env("HVAC_SIM_OPENAI_MODEL") or "gpt-4o-mini"
        found.append(Provider("openai", "https://api.openai.com/v1/chat/completions", key, model))
    if env("HVAC_SIM_LLM_PROVIDER") == "openai":
        found.reverse()
    return found


async def _ask(client: httpx.AsyncClient, provider: Provider, messages: list[dict[str, str]]) -> str:
    res = await client.post(
        provider.url,
        headers={"Authorization": f"Bearer {provider.key}"},
        json={"model": provider.model, "messages": messages, "max_tokens": MAX_REPLY_TOKENS, "temperature": 0.4},
    )
    res.raise_for_status()
    text = res.json()["choices"][0]["message"]["content"]
    if not isinstance(text, str) or not text.strip():
        raise ValueError("empty reply")
    return text.strip()


async def complete(messages: list[dict[str, str]]) -> tuple[str, str]:
    """Return (reply, provider name). Raises LlmError when every provider fails."""
    available = providers()
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
