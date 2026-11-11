from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.scenarios import DIAGNOSIS_BY_ID, SCENARIOS

GOOD_FURNACE: dict[str, Any] = {
    "callingForHeat": True,
    "burnersLit": True,
    "blowerRunning": True,
    "tempRiseF": 55,
    "manifoldWc": 3.5,
    "panelsInstalled": True,
}

CONDENSER_FINAL: dict[str, Any] = {
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


def test_furnace_session_carries_furnace_values_only(client: TestClient) -> None:
    session = start(client, "f-flame-sensor")
    assert session["unitType"] == "furnace" and session["unit"] is None
    assert session["furnace"]["flameSensorDirt"] > 0.5
    assert session["environment"]["outdoorF"] < 40


def test_cleaning_or_replacing_the_flame_sensor_both_count(client: TestClient) -> None:
    for repair in ("clean_flame_sensor", "replace_flame_sensor"):
        session = start(client, "f-flame-sensor")
        res = client.post(
            f"/api/sessions/{session['sessionId']}/submit",
            json={"diagnosisId": "f_flame_sensor", "repairs": [repair], "furnaceFinal": GOOD_FURNACE},
        )
        assert res.json()["score"] == 100


def test_condenser_readings_are_rejected_for_a_furnace_job(client: TestClient) -> None:
    session = start(client, "f-igniter")
    res = client.post(
        f"/api/sessions/{session['sessionId']}/submit",
        json={"diagnosisId": "f_igniter", "finalState": CONDENSER_FINAL},
    )
    assert res.status_code == 422


def test_furnace_left_overheating_is_not_verified(client: TestClient) -> None:
    session = start(client, "f-filter")
    res = client.post(
        f"/api/sessions/{session['sessionId']}/submit",
        json={"diagnosisId": "f_filter", "furnaceFinal": {**GOOD_FURNACE, "tempRiseF": 98}},
    )
    # diagnosis 45 + safety 15 + workmanship 5; no repair, not verified
    assert res.json()["score"] == 65


def test_every_scenario_matches_its_unit_type() -> None:
    for s in SCENARIOS:
        assert DIAGNOSIS_BY_ID[s.diagnosis_id].unit_type == s.unit_type
        assert (s.unit is None) != (s.furnace is None)
