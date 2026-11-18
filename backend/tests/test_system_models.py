"""Settings > Models: who may change the system models, availability by API key, and the config file."""
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app import llm
from app.main import create_app


@pytest.fixture
def app(tmp_path: Path, monkeypatch):
    monkeypatch.setenv("DEEPSEEK_API_KEY", "test-deepseek")
    monkeypatch.setenv("OPENAI_API_KEY", "test-openai")
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("HVAC_SIM_CONFIG", raising=False)
    monkeypatch.setenv("DEEPSEEK_MODELS", "deepseek-v4-pro,deepseek-flash")
    monkeypatch.setenv("OPENAI_MODELS", "gpt-6.2-sol,gpt-6-luna")
    monkeypatch.setenv("ANTHROPIC_MODELS", "claude-opus-5-5")
    return create_app(tmp_path / "test.db")


def local(app):
    return TestClient(app, client=("127.0.0.1", 1234), headers={"Host": "localhost:5173"})


def remote(app, email=None, monkeypatch=None):
    client = TestClient(app, client=("203.0.113.9", 1234), headers={"Host": "api.example.com"})
    if email and monkeypatch:
        # Feature tests skip real sign-in (conftest); stand in for the signed-in user.
        from app import auth
        def authorize(request, store):
            request.state.auth_user = {"id": 1, "email": email}
        monkeypatch.setattr(auth, "authorize", authorize)
    return client


def test_local_requests_see_options_with_unkeyed_providers_greyed_out(app):
    data = local(app).get("/api/models").json()
    assert data["canEdit"] is True
    assert data["chatbot"] == data["router"] == "deepseek:deepseek-flash"
    options = {o["id"]: o for o in data["options"]}
    assert options["openai:gpt-6.2-sol"]["available"] is True
    assert options["anthropic:claude-opus-5-5"] == {**options["anthropic:claude-opus-5-5"], "available": False, "reason": "no API key"}


def test_change_is_saved_in_the_config_file_and_used_for_chat(app, tmp_path, monkeypatch):
    client = local(app)
    data = client.put("/api/models", json={"chatbot": "openai:gpt-6.2-sol", "router": "deepseek:deepseek-v4-pro"}).json()
    assert (data["chatbot"], data["router"]) == ("openai:gpt-6.2-sol", "deepseek:deepseek-v4-pro")
    saved = json.loads((tmp_path / "app_config.json").read_text())
    assert saved == {"chatbotModel": "openai:gpt-6.2-sol", "routerModel": "deepseek:deepseek-v4-pro"}
    # The chosen model is tried first; the other provider stays as the fallback.
    assert [(p.name, p.model) for p in llm.providers("openai:gpt-6.2-sol")] == [("openai", "gpt-6.2-sol"), ("deepseek", "deepseek-flash")]
    seen = []
    async def complete(messages, model=None):
        seen.append(model)
        return "ok", "fake"
    monkeypatch.setattr(llm, "complete", complete)
    session = client.post("/api/sessions", json={"scenarioId": "orientation"}).json()["sessionId"]
    assert client.post(f"/api/sessions/{session}/chat", json={"message": "hi", "state": {}}).status_code == 200
    assert seen == ["openai:gpt-6.2-sol"]


def test_unavailable_or_unknown_models_are_refused(app):
    client = local(app)
    assert client.put("/api/models", json={"chatbot": "anthropic:claude-opus-5-5"}).status_code == 422
    assert client.put("/api/models", json={"router": "openai:not-a-model"}).status_code == 422


def test_other_users_see_the_current_models_read_only(app, monkeypatch):
    client = remote(app, "someone@example.com", monkeypatch)
    data = client.get("/api/models").json()
    assert data == {"canEdit": False, "chatbot": "deepseek:deepseek-flash", "router": "deepseek:deepseek-flash", "options": []}
    assert client.put("/api/models", json={"chatbot": "openai:gpt-6.2-sol"}).status_code == 403


def test_the_owner_account_can_change_models_from_anywhere(app, monkeypatch):
    client = remote(app, "Chaz@PowerChalk.com", monkeypatch)
    assert client.get("/api/models").json()["canEdit"] is True
    assert client.put("/api/models", json={"chatbot": "openai:gpt-6-luna"}).json()["chatbot"] == "openai:gpt-6-luna"
