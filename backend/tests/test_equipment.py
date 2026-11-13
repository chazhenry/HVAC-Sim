import json
import sqlite3

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.contexts import CONTEXTS, apply_context
from app.equipment_registry import COMPONENT_REGISTRY, COMPONENTS
from app.faults import FAULTS, apply_faults
from app.main import create_app
from app.models import EquipmentJournal, FurnaceParams, UnitParams
from app.procedures import PROCEDURES, procedure_progress, procedure_score
from app.scenarios import SCENARIOS, SCENARIO_BY_ID
from test_api import GOOD_FINAL


CAP = "system.outdoor.runCapacitor"


def event(kind, component=CAP, **extra):
    return {"type": kind, "componentId": component, "t": 0, "safe": True, **extra}


def evidence():
    return [event("power.isolated", "system.outdoor.fuses"),
            event("measurement.voltage", value=0, unit="V", terminals=["CAP_HERM", "CAP_C"]),
            event("capacitor.discharged"),
            event("measurement.capacitance", value=8.6, unit="µF", terminals=["CAP_C", "CAP_HERM"]),
            event("component.replaced")]


def journal(events):
    return EquipmentJournal.model_validate({"schemaVersion": 1, "events": events})


def test_registry_references_and_all_faults():
    assemblies = {item["id"] for item in COMPONENT_REGISTRY["assemblies"]}
    assert len(COMPONENTS) == len(COMPONENT_REGISTRY["components"])
    terminals = [terminal for item in COMPONENTS.values() for terminal in item["terminals"]]
    assert len(terminals) == len(set(terminals))
    for component in COMPONENTS.values():
        assert component["assemblyId"] in assemblies
    for definition in FAULTS.values():
        assert COMPONENTS[definition["componentId"]]["unitType"] == definition["unitType"]
        nominal = UnitParams() if definition["unitType"] == "condenser" else FurnaceParams()
        before = nominal.model_dump()
        assert apply_faults(nominal, (definition["id"],)) != nominal
        assert nominal.model_dump() == before
    for scenario in SCENARIOS:
        assert all(key in FAULTS for key in scenario.fault_ids)
    for procedure in PROCEDURES.values():
        ids = {step["id"] for step in procedure["steps"]}
        for step in procedure["steps"]:
            assert step["componentId"] in COMPONENTS
            assert set(step["requires"]) <= ids


def test_contexts_keep_ratings_and_runtime_faults_isolated():
    context = next(item for item in CONTEXTS if item.id == "goodman-gszb403610")
    nominal = context.model_dump()
    first = apply_context(SCENARIO_BY_ID["hum-no-start"], context)
    second = apply_context(SCENARIO_BY_ID["hum-no-start"], context)
    assert first.unit.capacitor.herm_uf == pytest.approx(40 * 8.6 / 45)
    first.unit.capacitor.herm_uf = 40
    assert second.unit.capacitor.herm_uf < 10
    assert context.model_dump() == nominal
    with pytest.raises(ValueError):
        apply_faults(FurnaceParams(), ("condenser.cap_herm",))


def test_milestones_require_evidence_in_order_and_backend_verification():
    full = journal(evidence())
    assert procedure_score("capacitor-start-diagnosis", full, True).points == 20
    assert procedure_score("capacitor-start-diagnosis", full, False).points == 16
    assert procedure_progress("capacitor-start-diagnosis", journal(list(reversed(evidence()))), True) == {"isolate"}
    unsafe = evidence()
    unsafe[-1]["safe"] = False
    assert "replace" not in procedure_progress("capacitor-start-diagnosis", journal(unsafe), True)
    interrupted = evidence()[:-1] + [event("power.restored", "system.outdoor.fuses"), event("power.isolated", "system.outdoor.fuses"), event("component.replaced")]
    assert "replace" not in procedure_progress("capacitor-start-diagnosis", journal(interrupted), True)
    restored = evidence() + [event("power.restored", "system.outdoor.fuses")]
    assert procedure_score("capacitor-start-diagnosis", journal(restored), True).points == 20


@pytest.mark.parametrize("events", [
    [event("component.replaced", "unknown")],
    [event("measurement.voltage", value=0, unit="µF", terminals=["CAP_C", "CAP_HERM"])],
    [event("measurement.voltage", value=0, unit="V", terminals=["CAP_C", "CONT_L1"])],
    [event("component.replaced", t=2), event("component.replaced", t=1)],
    [event("operation.verified", "system.outdoor.compressor")],
])
def test_invalid_journals_are_rejected(events):
    with pytest.raises(ValidationError):
        journal(events)


def test_api_grades_and_persists_versioned_evidence(tmp_path):
    path = tmp_path / "equipment.db"
    client = TestClient(create_app(path))
    session = client.post("/api/sessions", json={"scenarioId": "hum-no-start"}).json()
    assert session["procedureId"] == "capacitor-start-diagnosis"
    submitted = {"schemaVersion": 1, "events": evidence()}
    response = client.post(f'/api/sessions/{session["sessionId"]}/submit', json={
        "diagnosisId": "cap_herm", "repairs": ["replace_capacitor"],
        "finalState": GOOD_FINAL, "equipmentJournal": submitted,
    })
    assert response.status_code == 200
    assert response.json()["score"] == 100
    assert response.json()["breakdown"][1]["label"] == "Diagnostic procedure"
    with sqlite3.connect(path) as db:
        version, payload = db.execute("SELECT schema_version, events_json FROM session_journals WHERE session_id = ?", (session["sessionId"],)).fetchone()
    assert version == 1
    assert EquipmentJournal.model_validate(json.loads(payload)) == journal(evidence())
