"""Tiny SQLite-backed store for training sessions and their results."""

from __future__ import annotations

import sqlite3
import threading
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS sessions (
    id          TEXT PRIMARY KEY,
    scenario_id TEXT NOT NULL,
    started_at  TEXT NOT NULL,
    hints_used  INTEGER NOT NULL DEFAULT 0,
    finished_at TEXT,
    score       INTEGER,
    result_json TEXT
);
CREATE TABLE IF NOT EXISTS visits (
    id          TEXT PRIMARY KEY,
    visited_at  TEXT NOT NULL,
    ip          TEXT NOT NULL,
    city        TEXT,
    state       TEXT,
    country     TEXT,
    app_version TEXT NOT NULL,
    event       TEXT NOT NULL DEFAULT 'home',
    user        TEXT
);
CREATE INDEX IF NOT EXISTS visits_ip_time ON visits (ip, visited_at);
CREATE INDEX IF NOT EXISTS visits_time ON visits (visited_at DESC, id DESC);
"""


@dataclass(frozen=True)
class SessionRow:
    id: str
    scenario_id: str
    started_at: str
    hints_used: int
    finished_at: str | None
    score: int | None


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class SessionStore:
    def __init__(self, path: Path | str) -> None:
        self._lock = threading.Lock()
        self._db = sqlite3.connect(str(path), check_same_thread=False)
        self._db.row_factory = sqlite3.Row
        with self._lock, self._db:
            self._db.executescript(SCHEMA)
            # Upgrade existing installations without losing their recorded visits.
            self._db.execute("BEGIN IMMEDIATE")
            columns = {row["name"] for row in self._db.execute("PRAGMA table_info(visits)")}
            if "event" not in columns:
                self._db.execute("ALTER TABLE visits ADD COLUMN event TEXT NOT NULL DEFAULT 'home'")
            if "user" not in columns:
                self._db.execute("ALTER TABLE visits ADD COLUMN user TEXT")

    def record_visit(self, visit_id: str, ip: str, app_version: str, event: str = "home", user: str | None = None) -> bool:
        """Persist before geolocation; retrying a visit ID cannot count it twice."""
        with self._lock, self._db:
            cursor = self._db.execute(
                "INSERT OR IGNORE INTO visits (id, visited_at, ip, app_version, event, user) VALUES (?, ?, ?, ?, ?, ?)",
                (visit_id, _now(), ip, app_version, event, user),
            )
        return cursor.rowcount == 1

    def browse_visits(self, search: str, limit: int, offset: int) -> tuple[list[dict], int]:
        # Literal substring matching across visible fields; all input is parameterized.
        where = (
            "WHERE instr(lower(ip || ' ' || COALESCE(city, '') || ' ' || "
            "COALESCE(state, '') || ' ' || COALESCE(country, '') || ' ' || "
            "app_version || ' ' || visited_at || ' ' || event || ' ' || COALESCE(user, '')), lower(?)) > 0"
        )
        with self._lock:
            total = self._db.execute("SELECT COUNT(*) FROM visits " + where, (search,)).fetchone()[0]
            rows = self._db.execute(
                "SELECT * FROM visits " + where + " ORDER BY visited_at DESC, id DESC LIMIT ? OFFSET ?",
                (search, limit, offset),
            ).fetchall()
        return [dict(row) for row in rows], total

    def recent_location(self, ip: str, since: str) -> dict[str, str | None] | None:
        with self._lock:
            row = self._db.execute(
                "SELECT city, state, country FROM visits "
                "WHERE ip = ? AND visited_at >= ? AND country IS NOT NULL "
                "ORDER BY visited_at DESC LIMIT 1",
                (ip, since),
            ).fetchone()
        return dict(row) if row is not None else None

    def locate_visit(self, visit_id: str, location: dict[str, str | None]) -> None:
        with self._lock, self._db:
            self._db.execute(
                "UPDATE visits SET city = ?, state = ?, country = ? WHERE id = ?",
                (location["city"], location["state"], location["country"], visit_id),
            )

    def create(self, scenario_id: str) -> SessionRow:
        session_id = uuid.uuid4().hex
        with self._lock, self._db:
            self._db.execute(
                "INSERT INTO sessions (id, scenario_id, started_at) VALUES (?, ?, ?)",
                (session_id, scenario_id, _now()),
            )
        row = self.get(session_id)
        assert row is not None
        return row

    def get(self, session_id: str) -> SessionRow | None:
        with self._lock:
            row = self._db.execute(
                "SELECT id, scenario_id, started_at, hints_used, finished_at, score "
                "FROM sessions WHERE id = ?",
                (session_id,),
            ).fetchone()
        if row is None:
            return None
        return SessionRow(**dict(row))

    def use_hint(self, session_id: str, max_hints: int) -> int:
        """Reveal one more hint (capped at max_hints) and return the count used."""
        with self._lock, self._db:
            self._db.execute(
                "UPDATE sessions SET hints_used = MIN(hints_used + 1, ?) WHERE id = ?",
                (max_hints, session_id),
            )
            row = self._db.execute(
                "SELECT hints_used FROM sessions WHERE id = ?", (session_id,)
            ).fetchone()
        return int(row["hints_used"])

    def finish(self, session_id: str, score: int, result_json: str) -> None:
        with self._lock, self._db:
            self._db.execute(
                "UPDATE sessions SET finished_at = ?, score = ?, result_json = ? WHERE id = ?",
                (_now(), score, result_json, session_id),
            )

    def history(self, limit: int = 50) -> list[SessionRow]:
        with self._lock:
            rows = self._db.execute(
                "SELECT id, scenario_id, started_at, hints_used, finished_at, score "
                "FROM sessions WHERE finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT ?",
                (limit,),
            ).fetchall()
        return [SessionRow(**dict(r)) for r in rows]
