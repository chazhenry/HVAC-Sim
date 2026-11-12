"""Equipment profiles are JSON; scenarios inject faults without replacing nominal ratings."""
from dataclasses import replace
from pathlib import Path

from .models import EquipmentContext, UnitParams, FurnaceParams
from .scenarios import Scenario

CONTEXTS = tuple(EquipmentContext.model_validate_json(path.read_text(encoding="utf-8"))
                 for path in sorted((Path(__file__).parent / "equipment").glob("*.json")))


def apply_context(scenario: Scenario, context: EquipmentContext) -> Scenario:
    if context.unit_type != scenario.unit_type:
        raise ValueError("This service call does not match the selected equipment")
    if scenario.id.startswith("hp-") and context.system_type != "heat_pump":
        raise ValueError("This service call requires a heat pump")
    # Faults are differences from the original generic unit, applied over profile defaults.
    def overlay(base: dict, fault: dict, normal: dict) -> dict:
        result = dict(base)
        for key, value in fault.items():
            if isinstance(value, dict):
                result[key] = overlay(base[key], value, normal[key])
            elif value != normal[key]:
                result[key] = value
        return result
    if scenario.unit is not None and context.unit is not None:
        nominal = context.unit.model_dump()
        params = overlay(nominal, scenario.unit.model_dump(), UnitParams().model_dump())
        if scenario.diagnosis_id == "cap_herm":
            params["capacitor"]["herm_uf"] = nominal["capacitor"]["rated_herm_uf"] * 8.6 / 45
        return replace(scenario, unit=UnitParams(**params),
                       environment=scenario.environment if scenario.id.startswith("hp-") else context.environment)
    assert scenario.furnace is not None and context.furnace is not None
    return replace(scenario, furnace=FurnaceParams(**overlay(context.furnace.model_dump(), scenario.furnace.model_dump(), FurnaceParams().model_dump())),
                   environment=context.environment)
