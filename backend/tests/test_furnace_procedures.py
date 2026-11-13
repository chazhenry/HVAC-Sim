import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.main import create_app
from app.models import EquipmentJournal
from app.procedures import PROCEDURES, procedure_progress, procedure_score
from app.scenarios import SCENARIO_BY_ID
from test_furnace import GOOD_FURNACE


def event(kind, component, **extra):
    return dict(type=kind, componentId="system.indoor." + component, safe=True, t=0, **extra)


def volts(component, a, b, value):
    return event("measurement.voltage", component, terminals=[a, b], value=value, unit="V")


def opened(component, a, b):
    return event("measurement.resistance", component, terminals=[a, b], status="open", unit="Ω")


def pressure(channel, value):
    return event("measurement.pressure", "pressureSwitch" if channel == "draft" else "gasValve", channel=channel, value=value, unit="inH2O")


def flame(value):
    return event("measurement.current", "flameSensor", terminals=["F_FS_ROD", "F_BD_FS"], value=value, unit="µA")


def rise(value):
    return event("measurement.temperatureRise", "filter", channel="rise", value=value, unit="°F")


CASES = {
    "f-orientation": ([flame(3.5), pressure("manifold", 3.5), rise(52)], [], None),
    "f-flame-sensor": ([flame(.36)], [], ("component.cleaned", "flameSensor")),
    "f-igniter": ([volts("igniter", "F_IGN_H", "F_IGN_N", 120)], [opened("igniter", "F_IGN_H", "F_IGN_N")], ("component.replaced", "igniter")),
    "f-inducer": ([volts("inducer", "F_IND_H", "F_IND_N", 120)], [opened("inducer", "F_IND_H", "F_IND_N")], ("component.replaced", "inducer")),
    "f-pressure-switch": ([pressure("draft", -1.1), volts("pressureSwitch", "F_PS_A", "F_PS_B", 24)], [], ("component.replaced", "pressureSwitch")),
    "f-gas-off": ([pressure("inlet", 0), volts("gasValve", "F_GV_MV", "F_GV_C", 24)], [], ("gas.opened", "gasSupply")),
    "f-gas-valve": ([pressure("inlet", 7), pressure("manifold", 0), volts("gasValve", "F_GV_MV", "F_GV_C", 24)],
                    [opened("gasValve", "F_GV_MV", "F_GV_C"), event("gas.closed", "gasSupply")], ("component.replaced", "gasValve")),
    "f-filter": ([rise(90), event("component.inspected", "filter")], [], ("component.replaced", "filter")),
    "f-blower-cap": ([volts("blower", "F_BLW_H", "F_BLW_N", 120)],
                     [event("capacitor.discharged", "blowerCapacitor"), event("measurement.capacitance", "blowerCapacitor", value=1.1, unit="µF", terminals=["F_BCAP_B", "F_BCAP_A"])],
                     ("component.replaced", "blowerCapacitor")),
    "f-fuse": ([volts("lvFuse", "F_BD_SEC", "F_BD_C", 24), volts("lvFuse", "F_BD_R", "F_BD_C", 0)], [], ("component.replaced", "lvFuse")),
}


def evidence(scenario_id):
    live, isolated, repair = CASES[scenario_id]
    if repair is None:
        return list(live)
    return [*live, event("power.isolated", "serviceSwitch"), volts("serviceSwitch", "F_SW_N", "F_SW_LOAD", 0),
            *isolated, event(*repair), event("power.restored", "serviceSwitch")]


def journal(events):
    return EquipmentJournal.model_validate({"schemaVersion": 1, "events": events})


@pytest.mark.parametrize("scenario_id", CASES)
def test_each_furnace_job_grades_and_keeps_legacy_clients_compatible(tmp_path, scenario_id):
    scenario = SCENARIO_BY_ID[scenario_id]
    procedure_id = scenario.procedure_id
    assert procedure_id == scenario_id + "-diagnosis"
    good = journal(evidence(scenario_id))
    assert procedure_score(procedure_id, good, True).points == 20
    assert procedure_score(procedure_id, good, False).points < 20
    client = TestClient(create_app(tmp_path / "furnace.db"))
    for with_journal in (True, False):
        session = client.post("/api/sessions", json={"scenarioId": scenario_id}).json()
        assert session["procedureId"] == procedure_id
        payload = {"diagnosisId": scenario.diagnosis_id,
                   "repairs": [scenario.required_repair.value] if scenario.required_repair else [], "furnaceFinal": GOOD_FURNACE}
        if with_journal:
            payload["equipmentJournal"] = good.model_dump(by_alias=True)
        response = client.post(f'/api/sessions/{session["sessionId"]}/submit', json=payload)
        assert response.status_code == 200
        assert response.json()["score"] == 100
        assert response.json()["breakdown"][1]["label"] == ("Diagnostic procedure" if with_journal else "Repair")


@pytest.mark.parametrize("scenario_id", [key for key in CASES if key != "f-orientation"])
def test_parts_without_diagnostic_and_safety_evidence_do_not_complete_procedure(scenario_id):
    proc = scenario_id + "-diagnosis"
    repair = event(*CASES[scenario_id][2])
    assert procedure_progress(proc, journal([repair]), True) == set()
    events = evidence(scenario_id)
    repair_index = next(i for i, e in enumerate(events) if e == repair)
    interrupted = events[:repair_index] + [event("power.restored", "serviceSwitch"), event("power.isolated", "serviceSwitch"), repair]
    assert "repair" not in procedure_progress(proc, journal(interrupted), True)
    unsafe = [{**e, "safe": False} if e == repair else e for e in events]
    assert "repair" not in procedure_progress(proc, journal(unsafe), True)


def test_flame_sensor_alternative_and_gas_isolation_rules():
    events = evidence("f-flame-sensor")
    replaced = [{**e, "type": "component.replaced"} if e["type"] == "component.cleaned" else e for e in events]
    assert procedure_score("f-flame-sensor-diagnosis", journal(replaced), True).points == 20
    events = evidence("f-gas-valve")
    missing = [e for e in events if e["type"] != "gas.closed"]
    assert "repair" not in procedure_progress("f-gas-valve-diagnosis", journal(missing), True)
    index = next(i for i, e in enumerate(events) if e["type"] == "component.replaced")
    reopened = events[:index] + [event("gas.opened", "gasSupply")] + events[index:]
    assert "repair" not in procedure_progress("f-gas-valve-diagnosis", journal(reopened), True)


def test_draft_and_pressure_channels_are_validated():
    assert journal([pressure("draft", -1.1)]).events[0].value == -1.1
    for invalid in [pressure("rise", 0), {**flame(1), "value": -1},
                    {**opened("igniter", "F_IGN_H", "F_IGN_N"), "value": 50},
                    {**pressure("inlet", 7), "unit": "V"}]:
        with pytest.raises(ValidationError):
            journal([invalid])


def test_procedure_graphs_are_acyclic_and_total_twenty_points():
    for procedure in PROCEDURES.values():
        assert sum(step["points"] for step in procedure["steps"]) == 20
        pending = {step["id"]: set(step["requires"]) for step in procedure["steps"]}
        while pending:
            ready = {key for key, needs in pending.items() if not needs}
            assert ready, f'Cyclic or missing prerequisites in {procedure["id"]}'
            pending = {key: needs - ready for key, needs in pending.items() if key not in ready}
