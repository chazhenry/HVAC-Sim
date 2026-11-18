"""Settings > Models: the system chatbot and router models, kept in the app-wide config file.

Everyone signed in can see the current models. Only the site owner can change them: a request
from this machine or the home network (`auth.local_dev_request`), or the owner's account.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from pydantic import Field

from . import auth, llm
from .app_config import AppConfig
from .models import ApiModel

MODEL_ADMIN_EMAILS = frozenset({"chaz@powerchalk.com"})
SETTINGS = {"chatbot": "chatbotModel", "router": "routerModel"}


class ModelChoice(ApiModel):
    id: str
    provider: str
    model: str
    available: bool
    reason: str | None = None


class ModelSettings(ApiModel):
    can_edit: bool
    chatbot: str | None
    router: str | None
    # Only sent to people who can change the models.
    options: list[ModelChoice] = Field(default_factory=list)


class ModelUpdate(ApiModel):
    chatbot: str | None = Field(default=None, max_length=120)
    router: str | None = Field(default=None, max_length=120)


def can_edit_models(request: Request) -> bool:
    user = getattr(request.state, "auth_user", None)
    return auth.local_dev_request(request) or (user is not None and str(user["email"]).lower() in MODEL_ADMIN_EMAILS)


def system_model(config: AppConfig, setting: str) -> str | None:
    """The chosen model for "chatbot" or "router", or the default when none is chosen or it went away."""
    chosen = config.get(SETTINGS[setting])
    return chosen if isinstance(chosen, str) and llm.usable_model(chosen) else llm.default_model()


def models_router(config: AppConfig) -> APIRouter:
    router = APIRouter(prefix="/api/models")

    def current(request: Request) -> ModelSettings:
        editor = can_edit_models(request)
        return ModelSettings(
            can_edit=editor,
            chatbot=system_model(config, "chatbot"),
            router=system_model(config, "router"),
            options=[ModelChoice(**vars(o)) for o in llm.model_options()] if editor else [],
        )

    @router.get("", response_model=ModelSettings)
    def read(request: Request) -> ModelSettings:
        return current(request)

    @router.put("", response_model=ModelSettings)
    def change(body: ModelUpdate, request: Request) -> ModelSettings:
        if not can_edit_models(request):
            raise HTTPException(status_code=403, detail="Only the site owner can change the system models.")
        changes: dict[str, str] = {}
        for setting, value in (("chatbot", body.chatbot), ("router", body.router)):
            if value is None:
                continue
            if not llm.usable_model(value):
                raise HTTPException(status_code=422, detail=f"{value} is not an available model.")
            changes[SETTINGS[setting]] = value
        if changes:
            config.update(**changes)
        return current(request)

    return router
