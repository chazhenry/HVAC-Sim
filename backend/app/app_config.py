"""App-wide settings shared by every user, kept in a small JSON file.

The file lives next to the session database (`app_config.json`; on the server that is
/var/lib/hvac-sim, which survives deploys), or wherever HVAC_SIM_CONFIG points. Values not in
the file fall back to their defaults, so a missing file just means "all defaults".

Today it holds the system models: `chatbotModel` (the chat tutor) and `routerModel`.
"""

from __future__ import annotations

import json
import os
import threading
from pathlib import Path
from typing import Any

FILE_NAME = "app_config.json"
_lock = threading.Lock()


class AppConfig:
    """Reads and writes the app-wide config file. Writes are atomic (temp file, then rename)."""

    def __init__(self, path: Path | str) -> None:
        self.path = Path(path)

    @staticmethod
    def beside(db_path: Path | str) -> "AppConfig":
        explicit = os.environ.get("HVAC_SIM_CONFIG")
        return AppConfig(explicit if explicit else Path(db_path).resolve().parent / FILE_NAME)

    def read(self) -> dict[str, Any]:
        try:
            data = json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return {}
        return data if isinstance(data, dict) else {}

    def get(self, key: str, default: Any = None) -> Any:
        return self.read().get(key, default)

    def update(self, **values: Any) -> dict[str, Any]:
        with _lock:
            data = self.read()
            data.update(values)
            self.path.parent.mkdir(parents=True, exist_ok=True)
            temp = self.path.with_suffix(".tmp")
            temp.write_text(json.dumps(data, indent=2, sort_keys=True) + "\n", encoding="utf-8")
            os.replace(temp, self.path)
            return data
