"""Shared identity metadata; runtime state never lives in this registry."""
import json
from pathlib import Path

REGISTRY_DIR = Path(__file__).parent / "equipment" / "registry"
COMPONENT_REGISTRY = json.loads((REGISTRY_DIR / "components.json").read_text(encoding="utf-8"))
COMPONENTS = {item["id"]: item for item in COMPONENT_REGISTRY["components"]}
