from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.exam import QUESTIONS, QUESTIONS_BY_SECTION
from app.main import create_app

FINAL: dict[str, Any] = {
    "callingForCooling": True,
    "compressorRunning": True,
    "fanRunning": True,
    "suctionPsig": 118,
    "liquidPsig": 380,
    "superheatF": 10,
    "subcoolF": 10,
    "panelsInstalled": True,
}

GOOD_SERVICE: dict[str, Any] = {
    "openedSystem": True,
    "openedAtPsig": -1.0,
    "testGas": "nitrogen",
    "pressureTestPsig": 150,
    "deepestMicrons": 240,
    "heldMicrons": 390,
    "finalChargeLb": 6.45,
    "factoryChargeLb": 6.5,
}


@pytest.fixture()
def client(tmp_path: Path) -> TestClient:
    return TestClient(create_app(tmp_path / "test.db"))


def submit(client: TestClient, service: dict[str, Any] | None) -> dict[str, Any]:
    sid = client.post("/api/sessions", json={"scenarioId": "c-608-drier"}).json()["sessionId"]
    body: dict[str, Any] = {
        "diagnosisId": "planned_drier",
        "repairs": ["replace_filter_drier"],
        "finalState": FINAL,
    }
    if service is not None:
        body["service"] = service
    return client.post(f"/api/sessions/{sid}/submit", json=body).json()


def test_question_bank_is_well_formed() -> None:
    assert len({q.id for q in QUESTIONS}) == len(QUESTIONS)
    for q in QUESTIONS:
        assert len(q.choices) == 4 and 0 <= q.answer < 4 and q.explanation
    assert all(len(qs) >= 8 for qs in QUESTIONS_BY_SECTION.values())


def test_paper_hides_answers_and_grading_reveals_them(client: TestClient) -> None:
    paper = client.get("/api/exam/type2").json()
    assert paper["passPercent"] == 70
    assert set(paper["questions"][0]) == {"id", "prompt", "choices"}
    key = {q.id: q.answer for q in QUESTIONS_BY_SECTION["type2"]}
    perfect = client.post("/api/exam/type2/grade", json={"answers": key}).json()
    assert perfect["passed"] and perfect["percent"] == 100
    blank = client.post("/api/exam/type2/grade", json={"answers": {}}).json()
    assert not blank["passed"] and blank["correct"] == 0
    assert blank["results"][0]["explanation"]
    assert client.get("/api/exam/type9").status_code == 422


def test_procedure_done_right_scores_100(client: TestClient) -> None:
    assert submit(client, GOOD_SERVICE)["score"] == 100


def test_each_skipped_practice_costs_points(client: TestClient) -> None:
    sloppy = {**GOOD_SERVICE, "openedAtPsig": 40, "deepestMicrons": 2500, "heldMicrons": None}
    result = submit(client, sloppy)
    line = next(item for item in result["breakdown"] if item["label"] == "Service procedure")
    assert line["points"] == 8
    assert "recover to 0 in. Hg" in line["note"] and "500 microns" in line["note"]
    assert submit(client, None)["score"] == 80
    assert submit(client, {**GOOD_SERVICE, "testGas": "oxygen"})["score"] == 96
