from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.scenarios import SCENARIOS

GOOD_FINAL: dict[str, Any] = {
    "callingForCooling": True,
    "compressorRunning": True,
    "fanRunning": True,
    "suctionPsig": 118,
    "liquidPsig": 380,
    "superheatF": 10,
    "subcoolF": 10,
    "panelsInstalled": True,
}


@pytest.fixture()
def client(tmp_path: Path) -> TestClient:
    return TestClient(create_app(tmp_path / "test.db"))


def start(client: TestClient, scenario_id: str) -> dict[str, Any]:
    res = client.post("/api/sessions", json={"scenarioId": scenario_id})
    assert res.status_code == 200
    return res.json()


def test_catalog_never_leaks_the_answer(client: TestClient) -> None:
    body = client.get("/api/catalog").json()
    assert len(body["scenarios"]) == len(SCENARIOS)
    for scenario in body["scenarios"]:
        assert set(scenario) == {"id", "unitType", "title", "difficulty", "complaint"}


def test_session_carries_physical_values_only(client: TestClient) -> None:
    body = start(client, "hum-no-start")
    assert body["unit"]["capacitor"]["hermUf"] < 20
    assert "diagnosisId" not in body and "explanation" not in body
    assert "diagnosisId" not in body["scenario"]


def test_perfect_job_scores_100(client: TestClient) -> None:
    session = start(client, "hum-no-start")
    res = client.post(
        f"/api/sessions/{session['sessionId']}/submit",
        json={"diagnosisId": "cap_herm", "repairs": ["replace_capacitor"], "finalState": GOOD_FINAL},
    )
    body = res.json()
    assert res.status_code == 200
    assert body["score"] == 100 and body["diagnosisCorrect"] is True


def test_wrong_diagnosis_parts_cannon_and_violations_cost_points(client: TestClient) -> None:
    session = start(client, "dead-unit-coil")
    res = client.post(
        f"/api/sessions/{session['sessionId']}/submit",
        json={
            "diagnosisId": "blown_fuse",
            "repairs": ["replace_contactor", "replace_capacitor", "replace_fuses"],
            "safetyViolations": ["Replaced a part with power on"],
            "finalState": GOOD_FINAL,
        },
    )
    body = res.json()
    assert body["diagnosisCorrect"] is False
    assert body["correctDiagnosis"]["id"] == "contactor_coil"
    # 0 diagnosis + (20 - 16) repair + 15 verify + 10 safety + 5 workmanship
    assert body["score"] == 34


def test_hints_are_progressive_capped_and_penalised(client: TestClient) -> None:
    session = start(client, "low-charge")
    sid = session["sessionId"]
    hints = [client.post(f"/api/sessions/{sid}/hint").json() for _ in range(5)]
    assert [h["hintsUsed"] for h in hints] == [1, 2, 3, 3, 3]
    assert hints[0]["hint"] != hints[1]["hint"]
    res = client.post(
        f"/api/sessions/{sid}/submit",
        json={"diagnosisId": "low_charge", "repairs": ["add_refrigerant"], "finalState": GOOD_FINAL},
    )
    assert res.json()["score"] == 85


def test_session_cannot_be_graded_twice_and_shows_in_history(client: TestClient) -> None:
    session = start(client, "orientation")
    url = f"/api/sessions/{session['sessionId']}/submit"
    payload = {"diagnosisId": "no_fault", "finalState": GOOD_FINAL}
    assert client.post(url, json=payload).status_code == 200
    assert client.post(url, json=payload).status_code == 409
    history = client.get("/api/history").json()
    assert history[0]["scenarioId"] == "orientation" and history[0]["score"] == 100


def test_unknown_ids_are_rejected(client: TestClient) -> None:
    assert client.post("/api/sessions", json={"scenarioId": "nope"}).status_code == 404
    assert client.post("/api/sessions/deadbeef/hint").status_code == 404
