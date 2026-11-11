from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app import llm, tutor
from app.main import create_app
from app.scenarios import SCENARIO_BY_ID


@pytest.fixture()
def client(tmp_path: Path) -> TestClient:
    return TestClient(create_app(tmp_path / "test.db"))


@pytest.fixture()
def sent(monkeypatch: pytest.MonkeyPatch) -> list[list[dict[str, str]]]:
    """Replace the LLM call and record what would have been sent."""
    calls: list[list[dict[str, str]]] = []

    async def fake(messages: list[dict[str, str]]) -> tuple[str, str]:
        calls.append(messages)
        return "Check for 240 V at the contactor line side.", "fake"

    monkeypatch.setattr(llm, "complete", fake)
    return calls


def session(client: TestClient, scenario_id: str = "hum-no-start") -> str:
    return client.post("/api/sessions", json={"scenarioId": scenario_id}).json()["sessionId"]


def test_chat_replies_and_sends_state(client: TestClient, sent: list[Any]) -> None:
    sid = session(client)
    res = client.post(
        f"/api/sessions/{sid}/chat",
        json={
            "message": "Where do I start?",
            "history": [{"role": "user", "content": "hi"}, {"role": "assistant", "content": "hello"}],
            "state": {"observations": {"Compressor": "loud hum, not running"}},
        },
    )
    assert res.status_code == 200
    assert res.json() == {"reply": "Check for 240 V at the contactor line side.", "provider": "fake"}
    system, *turns = sent[0]
    assert system["role"] == "system"
    assert "loud hum, not running" in system["content"]
    assert [t["content"] for t in turns] == ["hi", "hello", "Where do I start?"]


def test_chat_never_sends_the_answer_key(client: TestClient, sent: list[Any]) -> None:
    scenario = SCENARIO_BY_ID["hum-no-start"]
    sid = session(client, scenario.id)
    client.post(f"/api/sessions/{sid}/chat", json={"message": "What is wrong?", "state": {}})
    prompt = " ".join(m["content"] for m in sent[0])
    assert scenario.explanation not in prompt
    assert scenario.diagnosis_id not in prompt
    for hint in scenario.hints:
        assert hint not in prompt


def test_chat_needs_a_real_session(client: TestClient, sent: list[Any]) -> None:
    res = client.post("/api/sessions/nope/chat", json={"message": "hi", "state": {}})
    assert res.status_code == 404
    assert sent == []


def test_chat_rejects_oversized_message(client: TestClient, sent: list[Any]) -> None:
    sid = session(client)
    res = client.post(f"/api/sessions/{sid}/chat", json={"message": "x" * 5000, "state": {}})
    assert res.status_code == 422
    assert sent == []


def test_chat_is_capped_per_session(client: TestClient, sent: list[Any], monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(tutor, "MAX_PROMPTS_PER_SESSION", 2)
    sid = session(client)
    codes = [client.post(f"/api/sessions/{sid}/chat", json={"message": "hi", "state": {}}).status_code for _ in range(3)]
    assert codes == [200, 200, 429]


def test_chat_reports_missing_keys(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(llm, "providers", lambda: [])
    sid = session(client)
    res = client.post(f"/api/sessions/{sid}/chat", json={"message": "hi", "state": {}})
    assert res.status_code == 503


def test_env_file_does_not_override(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    env = tmp_path / ".env"
    env.write_text('A_NEW_KEY="from file"\nexport B_KEY=plain\n# comment\nALREADY=file\n', encoding="utf-8")
    monkeypatch.setenv("ALREADY", "real")
    monkeypatch.delenv("A_NEW_KEY", raising=False)
    monkeypatch.delenv("B_KEY", raising=False)
    llm.load_env_file(env)
    import os

    assert os.environ["A_NEW_KEY"] == "from file"
    assert os.environ["B_KEY"] == "plain"
    assert os.environ["ALREADY"] == "real"
    monkeypatch.delenv("A_NEW_KEY")
    monkeypatch.delenv("B_KEY")
