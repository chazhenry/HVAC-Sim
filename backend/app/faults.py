"""Explicit, reusable fault definitions applied to cloned nominal equipment."""
import copy
import json

from .equipment_registry import COMPONENTS, REGISTRY_DIR
from .models import FurnaceParams, UnitParams

FAULTS = {item["id"]: item for item in json.loads((REGISTRY_DIR / "faults.json").read_text(encoding="utf-8"))["faults"]}


def apply_faults(nominal: UnitParams | FurnaceParams, fault_ids: tuple[str, ...]) -> UnitParams | FurnaceParams:
    parameters = copy.deepcopy(nominal.model_dump(by_alias=True))
    unit_type = "condenser" if isinstance(nominal, UnitParams) else "furnace"
    for fault_id in fault_ids:
        fault = FAULTS[fault_id]
        if fault["unitType"] != unit_type or fault["componentId"] not in COMPONENTS:
            raise ValueError("Fault is incompatible with this equipment")
        for change in fault["changes"]:
            path = change["path"]
            target = parameters
            for key in path[:-1]:
                target = target[key]
            value = change["value"]
            if change["operation"] == "ratedFraction":
                rating = parameters
                for key in change["ratingPath"]:
                    rating = rating[key]
                value *= rating
            elif change["operation"] != "set":
                raise ValueError("Unsupported fault operation")
            if path[-1] not in target:
                raise ValueError("Fault targets an unknown physical parameter")
            target[path[-1]] = value
    return type(nominal).model_validate(parameters)
