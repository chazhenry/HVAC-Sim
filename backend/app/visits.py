"""Best-effort IP geolocation for persisted page visits."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from ipaddress import ip_address
from uuid import UUID

import httpx
from pydantic import Field, field_validator

from .models import ApiModel
from .store import SessionStore

VISITS_ADMIN_IP = "136.56.49.114"
VISITS_ADMIN_IPS = frozenset({VISITS_ADMIN_IP, "127.0.0.1", "::1", "::ffff:127.0.0.1"})


class VisitEntry(ApiModel):
    id: str
    visited_at: str
    ip: str
    city: str | None
    state: str | None
    country: str | None
    app_version: str
    event: str
    user: str | None


class VisitsPage(ApiModel):
    items: list[VisitEntry]
    total: int
    offset: int
    limit: int


class VisitRequest(ApiModel):
    visit_id: UUID
    app_version: str = Field(min_length=1, max_length=32)
    event: str = Field(default="home", min_length=1, max_length=64, pattern=r"^[a-z][a-z0-9_-]*$")
    user: str | None = Field(default=None, min_length=1, max_length=254)

    @field_validator("user", mode="before")
    @classmethod
    def trim_user(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


def locate_visit(store: SessionStore, visit_id: str, ip: str) -> None:
    """Runs after the response. Private IPs and failed lookups remain unlocated."""
    try:
        address = ip_address(ip)
    except ValueError:
        return
    if not address.is_global:
        return

    since = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    location = store.recent_location(ip, since)
    if location is None:
        try:
            response = httpx.get(
                f"https://ipwho.is/{address}",
                params={"fields": "success,city,region,country"},
                timeout=2.0,
            )
            response.raise_for_status()
            data = response.json()
        except (httpx.HTTPError, ValueError):
            return
        if not isinstance(data, dict) or data.get("success") is not True:
            return

        def text(key: str) -> str | None:
            value = data.get(key)
            if not isinstance(value, str):
                return None
            return value.strip()[:200] or None

        location = {"city": text("city"), "state": text("region"), "country": text("country")}
    store.locate_visit(visit_id, location)
