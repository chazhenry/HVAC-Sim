"""Equipment profiles are JSON; scenarios inject faults without replacing nominal ratings."""
from dataclasses import replace
from pathlib import Path

from .models import EquipmentContext
from .faults import apply_faults
from .scenarios import Scenario

CONTEXTS = tuple(EquipmentContext.model_validate_json(path.read_text(encoding="utf-8"))
                 for path in sorted((Path(__file__).parent / "equipment").glob("*.json")))


def apply_context(scenario: Scenario, context: EquipmentContext) -> Scenario:
    if context.unit_type != scenario.unit_type:
        raise ValueError("This service call does not match the selected equipment")
    if scenario.id.startswith("hp-") and context.system_type != "heat_pump":
        raise ValueError("This service call requires a heat pump")
    if scenario.unit is not None and context.unit is not None:
        return replace(scenario, unit=apply_faults(context.unit, scenario.fault_ids),
                       environment=scenario.environment if scenario.id.startswith("hp-") else context.environment)
    assert scenario.furnace is not None and context.furnace is not None
    return replace(scenario, furnace=apply_faults(context.furnace, scenario.fault_ids),
                   environment=context.environment)
