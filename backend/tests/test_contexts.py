from pathlib import Path
import sqlite3

from fastapi.testclient import TestClient

from app.contexts import CONTEXTS, apply_context
from app.main import create_app
from app.models import EquipmentContext
from app.scenarios import SCENARIO_BY_ID


def context(name: str) -> EquipmentContext:
    return next(item for item in CONTEXTS if item.id == name)


def test_context_round_trip_and_goodman_specs(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "test.db"))
    catalog = client.get("/api/catalog").json()
    assert {item["id"] for item in catalog["contexts"]} == {"generic-ac", "generic-furnace", "goodman-gszb403610"}
    goodman = context("goodman-gszb403610")
    response = client.post("/api/contexts/validate", json=goodman.model_dump(mode="json", by_alias=True))
    assert response.status_code == 200
    restored = EquipmentContext.model_validate_json(response.text)
    assert restored == goodman
    assert restored.unit.compressor.lra == 91.9
    assert restored.unit.capacitor.rated_herm_uf == 40
    assert restored.factory_charge_lb == 7.125
    assert restored.contactor_poles == 1
    assert restored.dimensions_m.width == 0.9017


def test_faults_survive_context_selection(tmp_path: Path) -> None:
    goodman = context("goodman-gszb403610")
    fault = apply_context(SCENARIO_BY_ID["hum-no-start"], goodman)
    assert fault.unit.capacitor.rated_herm_uf == 40
    assert fault.unit.capacitor.herm_uf < 10
    assert fault.unit.compressor.lra == 91.9
    generic = context("generic-furnace")
    for scenario in SCENARIO_BY_ID.values():
        if scenario.furnace is not None:
            assert apply_context(scenario, generic).furnace == scenario.furnace


def test_session_persists_context_and_validates_compatibility(tmp_path: Path) -> None:
    path = tmp_path / "contexts.db"
    client = TestClient(create_app(path))
    goodman = context("goodman-gszb403610").model_dump(mode="json", by_alias=True)
    response = client.post("/api/sessions", json={"scenarioId": "hp-heating", "context": goodman})
    assert response.status_code == 200
    body = response.json()
    assert body["environment"]["outdoorF"] == 35
    assert body["context"]["indoorModel"] == "AMST36CU1400"
    assert body["unit"]["compressor"]["lra"] == 91.9
    with sqlite3.connect(path) as db:
        saved = db.execute("SELECT config_json FROM session_contexts WHERE session_id = ?", (body["sessionId"],)).fetchone()[0]
    assert EquipmentContext.model_validate_json(saved).id == goodman["id"]
    reopened = TestClient(create_app(path))
    assert reopened.post(f'/api/sessions/{body["sessionId"]}/hint').status_code == 200
    assert client.post("/api/sessions", json={"scenarioId": "hp-heating"}).status_code == 422
    assert client.post("/api/sessions", json={"scenarioId": "hp-heating", "context": context("generic-ac").model_dump(mode="json", by_alias=True)}).status_code == 422
    for invalid in ({"schemaVersion": 2}, {"unitType": "furnace"}, {"heatPump": None}, {"cabinetColor": "bad"}):
        assert client.post("/api/contexts/validate", json={**goodman, **invalid}).status_code == 422
    assert client.post("/api/contexts/validate", json={**goodman, "unit": {"chargeFraction": "NaN"}}).status_code == 422
    assert client.post("/api/contexts/validate", json={**goodman, "unit": {"contactor": {"pole1Ohms": 0}}}).status_code == 422
