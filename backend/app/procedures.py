"""Milestones with prerequisites; unrelated actions and alternative lead order are allowed."""
import json

from .equipment_registry import REGISTRY_DIR
from .models import EquipmentJournal, ScoreLine

PROCEDURES = {item["id"]: item for item in json.loads((REGISTRY_DIR / "procedures.json").read_text(encoding="utf-8"))["procedures"]}


def procedure_progress(procedure_id: str, journal: EquipmentJournal, operation_verified: bool) -> set[str]:
    procedure = PROCEDURES[procedure_id]
    completed: set[str] = set()
    active: set[str] = set()
    events = [event.model_dump(by_alias=True) for event in journal.events]
    if operation_verified:
        events.append({"type": "operation.verified", "componentId": procedure["verificationComponentId"], "safe": True})
    for event in events:
        for step in procedure["steps"]:
            if event["type"] in step["invalidatedBy"]:
                active.discard(step["id"])
        if not event["safe"]:
            continue
        for step in procedure["steps"]:
            if event["type"] not in [step["eventType"], *step.get("eventTypes", [])] or event["componentId"] != step["componentId"]:
                continue
            if not set(step["requires"]).issubset(active):
                continue
            if "unit" in step and event.get("unit") != step["unit"]:
                continue
            if any(key in step and event.get(key) != step[key] for key in ("status", "channel")):
                continue
            if "minValue" in step and (event.get("value") is None or event["value"] < step["minValue"]):
                continue
            if "maxValue" in step and (event.get("value") is None or event["value"] > step["maxValue"]):
                continue
            if "terminals" in step and set(event.get("terminals", [])) != set(step["terminals"]):
                continue
            active.add(step["id"])
            completed.add(step["id"])
    return completed


def procedure_score(procedure_id: str, journal: EquipmentJournal, operation_verified: bool) -> ScoreLine:
    procedure = PROCEDURES[procedure_id]
    completed = procedure_progress(procedure_id, journal, operation_verified)
    missed = [step["label"] for step in procedure["steps"] if step["id"] not in completed]
    return ScoreLine(label="Diagnostic procedure", points=sum(step["points"] for step in procedure["steps"] if step["id"] in completed),
                     max_points=sum(step["points"] for step in procedure["steps"]),
                     note="All milestones verified." if not missed else "Missing evidence: " + "; ".join(missed) + ".")
