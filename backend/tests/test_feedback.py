import sqlite3
from pathlib import Path
from uuid import uuid4

from fastapi.testclient import TestClient

from app import llm
from app.main import create_app


def test_feedback_uses_original_exchange_and_tags_guest(tmp_path: Path, monkeypatch) -> None:
    path = tmp_path / "feedback.db"
    async def complete(messages):
        return "Measure at the contactor.", "test"
    monkeypatch.setattr(llm, "complete", complete)
    client = TestClient(create_app(path))
    session = client.post("/api/sessions", json={"scenarioId": "orientation"}).json()["sessionId"]
    reply = client.post(f"/api/sessions/{session}/chat", json={"message": "What next?"}).json()
    body = {"replyId": reply["replyId"], "rating": "up", "explanation": "  Clear next step.  ", "user": "  Jamie  ",
            "prompt": "forged prompt", "answer": "forged answer"}
    response = client.post("/api/feedback", json=body)
    assert response.status_code == 201
    with sqlite3.connect(path) as db:
        db.row_factory = sqlite3.Row
        row = db.execute("SELECT * FROM feedback").fetchone()
    assert row["prompt"] == "What next?"
    assert row["answer"] == "Measure at the contactor."
    assert row["user"] == "Jamie" and row["rating"] == "up"
    assert row["explanation"] == "Clear next step."
    # Revising feedback for the same reply and guest updates the same record.
    updated = client.post("/api/feedback", json={**body, "rating": "down", "explanation": "Please explain why."})
    assert updated.json()["id"] == response.json()["id"]
    with sqlite3.connect(path) as db:
        assert db.execute("SELECT COUNT(*) FROM feedback").fetchone()[0] == 1
        assert db.execute("SELECT rating FROM feedback").fetchone()[0] == "down"


def test_feedback_requires_explanation_identity_and_real_reply(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "feedback.db"))
    valid = {"replyId": str(uuid4()), "rating": "down", "explanation": "Needs detail", "user": "Jamie"}
    assert client.post("/api/feedback", json=valid).status_code == 404
    for invalid in ({"explanation": " "}, {"user": " "}, {"rating": "other"}, {"explanation": "x" * 4001}):
        assert client.post("/api/feedback", json={**valid, **invalid}).status_code == 422
