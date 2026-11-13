from __future__ import annotations

import sqlite3
from pathlib import Path
from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

from app.main import create_app
from app import visits
from app.store import SessionStore


def payload() -> dict[str, str]:
    return {"visitId": str(uuid4()), "appVersion": "26.11.11"}


def rows(path: Path) -> list[sqlite3.Row]:
    with sqlite3.connect(path) as db:
        db.row_factory = sqlite3.Row
        return db.execute("SELECT * FROM visits ORDER BY visited_at").fetchall()


def test_visits_persist_geolocation_and_deduplicate(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    path = tmp_path / "visits.db"
    calls = []

    def lookup(url: str, **kwargs: object) -> httpx.Response:
        calls.append(url)
        return httpx.Response(200, request=httpx.Request("GET", url), json={
            "success": True, "city": "New York", "region": "New York", "country": "United States",
        })

    monkeypatch.setattr(visits.httpx, "get", lookup)
    client = TestClient(create_app(path), client=("8.8.8.8", 1234))
    body = payload()
    assert client.post("/api/visits", json=body).status_code == 202
    assert client.post("/api/visits", json=body).status_code == 202
    # A new page load counts again, but reuses location for the same IP.
    assert client.post("/api/visits", json=payload()).status_code == 202
    result = rows(path)
    assert len(result) == 2
    assert len(calls) == 1
    assert calls[0] == "https://ipwho.is/8.8.8.8"
    assert dict(result[0]) == {
        "id": body["visitId"], "visited_at": result[0]["visited_at"], "ip": "8.8.8.8",
        "city": "New York", "state": "New York", "country": "United States", "app_version": "26.11.11", "event": "home", "user": None, "user_id": None,
    }
    assert result[0]["visited_at"].endswith("+00:00")
    # Opening the existing database preserves visits and the sessions schema.
    reopened = TestClient(create_app(path))
    assert reopened.get("/api/history").status_code == 200
    assert len(rows(path)) == 2


@pytest.mark.parametrize("failure", ["timeout", "rate_limit", "invalid_json", "unsuccessful", "invalid_shape"])
def test_lookup_failure_still_records_visit(tmp_path: Path, monkeypatch: pytest.MonkeyPatch, failure: str) -> None:
    path = tmp_path / "visits.db"

    def lookup(url: str, **kwargs: object) -> httpx.Response:
        request = httpx.Request("GET", url)
        if failure == "timeout":
            raise httpx.ReadTimeout("timeout", request=request)
        if failure == "rate_limit":
            return httpx.Response(429, request=request)
        if failure == "invalid_json":
            return httpx.Response(200, request=request, text="unavailable")
        return httpx.Response(200, request=request, json=[] if failure == "invalid_shape" else {"success": False})

    monkeypatch.setattr(visits.httpx, "get", lookup)
    client = TestClient(create_app(path), client=("8.8.8.8", 1234))
    assert client.post("/api/visits", json=payload()).status_code == 202
    visit = rows(path)[0]
    assert visit["ip"] == "8.8.8.8"
    assert visit["city"] is None and visit["state"] is None and visit["country"] is None


def test_private_ip_is_not_geolocated_or_overridden_by_headers(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    path = tmp_path / "visits.db"

    def unexpected(*args: object, **kwargs: object) -> None:
        pytest.fail("Private IP must not be sent to geolocation provider")

    monkeypatch.setattr(visits.httpx, "get", unexpected)
    app = ProxyHeadersMiddleware(create_app(path), trusted_hosts=["127.0.0.1"])
    client = TestClient(app, client=("192.168.1.2", 1234))
    assert client.post("/api/visits", json=payload(), headers={
        "X-Forwarded-For": "8.8.8.8", "CF-Connecting-IP": "8.8.8.8", "X-Real-IP": "8.8.8.8",
    }).status_code == 202
    assert rows(path)[0]["ip"] == "192.168.1.2"


def test_trusted_proxy_uses_rightmost_untrusted_ip(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    path = tmp_path / "visits.db"
    monkeypatch.setattr(visits.httpx, "get", lambda *args, **kwargs: httpx.Response(200, json={"success": False}, request=httpx.Request("GET", "https://ipwho.is")))
    app = ProxyHeadersMiddleware(create_app(path), trusted_hosts=["127.0.0.1"])
    client = TestClient(app, client=("127.0.0.1", 1234))
    assert client.post("/api/visits", json=payload(), headers={
        "X-Forwarded-For": "1.1.1.1, 8.8.8.8",
    }).status_code == 202
    assert rows(path)[0]["ip"] == "8.8.8.8"


def test_invalid_visit_does_not_write(tmp_path: Path) -> None:
    path = tmp_path / "visits.db"
    client = TestClient(create_app(path))
    assert client.post("/api/visits", json={"visitId": "bad", "appVersion": "x"}).status_code == 422
    assert client.post("/api/visits", json={**payload(), "appVersion": "x" * 33}).status_code == 422
    assert rows(path) == []


@pytest.mark.parametrize("ip", ["8.8.8.8", "136.56.49.115", "::ffff:136.56.49.114"])
def test_visits_admin_denies_other_ips_and_spoofed_headers(tmp_path: Path, ip: str) -> None:
    app = ProxyHeadersMiddleware(create_app(tmp_path / "visits.db"), trusted_hosts=["127.0.0.1"])
    client = TestClient(app, client=(ip, 1234))
    # Cloudflare and X-Real-IP headers are never trusted by the application itself.
    headers = {"CF-Connecting-IP": visits.VISITS_ADMIN_IP, "X-Real-IP": visits.VISITS_ADMIN_IP}
    headers["X-Forwarded-For"] = visits.VISITS_ADMIN_IP
    access = client.get("/api/visits/access", headers=headers)
    assert access.json() == {"allowed": False}
    assert access.headers["cache-control"] == "no-store"
    assert client.get("/api/visits", headers=headers).status_code == 403


def test_visits_admin_browses_searches_and_paginates(tmp_path: Path) -> None:
    path = tmp_path / "visits.db"
    app = ProxyHeadersMiddleware(create_app(path), trusted_hosts=["127.0.0.1"])
    store = SessionStore(path)
    for index in range(3):
        store.record_visit(f"visit-{index}", f"8.8.8.{index}", "26.11.11")
        store.locate_visit(f"visit-{index}", {
            "city": "New York" if index == 0 else "Boston", "state": "NY" if index == 0 else "MA", "country": "United States",
        })
    # Same path used by production: nginx's resolved client arrives through trusted loopback.
    client = TestClient(app, client=("127.0.0.1", 1234))
    headers = {"X-Forwarded-For": f"1.1.1.1, {visits.VISITS_ADMIN_IP}"}
    assert client.get("/api/visits/access", headers=headers).json() == {"allowed": True}
    response = client.get("/api/visits?limit=2", headers=headers)
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    first = response.json()
    assert first["total"] == 3 and first["offset"] == 0 and first["limit"] == 2
    assert len(first["items"]) == 2
    assert first["items"][0]["visitedAt"] >= first["items"][1]["visitedAt"]
    assert first["items"][0]["appVersion"] == "26.11.11"
    second = client.get("/api/visits?limit=2&offset=2", headers=headers).json()
    assert len(second["items"]) == 1
    assert {item["id"] for item in first["items"]}.isdisjoint(item["id"] for item in second["items"])
    filtered = client.get("/api/visits?search=new%20york", headers=headers).json()
    assert filtered["total"] == 1
    assert filtered["items"][0]["ip"] == "8.8.8.0"
    assert filtered["items"][0]["state"] == "NY"
    assert client.get("/api/visits", params={"search": "' OR 1=1 --"}, headers=headers).json()["total"] == 0
    assert client.get("/api/visits?offset=100", headers=headers).json()["items"] == []
    for params in ({"limit": 201}, {"limit": 0}, {"offset": -1}, {"search": "x" * 201}):
        assert client.get("/api/visits", params=params, headers=headers).status_code == 422


def test_visits_admin_rechecks_ip_on_each_request(tmp_path: Path) -> None:
    app = create_app(tmp_path / "visits.db")
    allowed = TestClient(app, client=(visits.VISITS_ADMIN_IP, 1234))
    assert allowed.get("/api/visits/access").json() == {"allowed": True}
    assert allowed.get("/api/visits").status_code == 200
    denied = TestClient(app, client=("8.8.8.8", 1234))
    assert denied.get("/api/visits").status_code == 403


@pytest.mark.parametrize("ip", ["127.0.0.1", "::1", "::ffff:127.0.0.1"])
def test_visits_admin_allows_localhost(tmp_path: Path, ip: str) -> None:
    client = TestClient(create_app(tmp_path / "visits.db"), client=(ip, 1234))
    assert client.get("/api/visits/access").json() == {"allowed": True}
    assert client.get("/api/visits").status_code == 200


def test_loopback_proxy_does_not_grant_access_to_remote_visitors(tmp_path: Path) -> None:
    app = ProxyHeadersMiddleware(create_app(tmp_path / "visits.db"), trusted_hosts=["127.0.0.1"])
    client = TestClient(app, client=("127.0.0.1", 1234))
    headers = {"X-Forwarded-For": "8.8.8.8"}
    assert client.get("/api/visits/access", headers=headers).json() == {"allowed": False}
    assert client.get("/api/visits", headers=headers).status_code == 403


@pytest.mark.parametrize("ip", sorted(visits.VISITS_ADMIN_IPS))
@pytest.mark.parametrize("event", ["home", "start_job"])
def test_admin_events_are_excluded_but_log_access_remains(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, ip: str, event: str,
) -> None:
    path = tmp_path / "visits.db"

    def unexpected(*args: object, **kwargs: object) -> None:
        pytest.fail("Excluded visitors must not trigger location lookups")

    monkeypatch.setattr(visits.httpx, "get", unexpected)
    client = TestClient(create_app(path), client=(ip, 1234))
    response = client.post("/api/visits", json={**payload(), "event": event})
    assert response.status_code == 202
    assert response.json() == {"status": "excluded"}
    assert rows(path) == []
    assert client.get("/api/visits/access").json() == {"allowed": True}
    assert client.get("/api/visits").status_code == 200


def test_forwarded_admin_is_excluded_and_remote_visitor_is_recorded(tmp_path: Path) -> None:
    path = tmp_path / "visits.db"
    app = ProxyHeadersMiddleware(create_app(path), trusted_hosts=["127.0.0.1"])
    client = TestClient(app, client=("127.0.0.1", 1234))
    assert client.post("/api/visits", json=payload(), headers={
        "X-Forwarded-For": visits.VISITS_ADMIN_IP,
    }).json() == {"status": "excluded"}
    assert client.post("/api/visits", json=payload(), headers={
        "X-Forwarded-For": "192.168.1.2",
    }).json() == {"status": "accepted"}
    assert [row["ip"] for row in rows(path)] == ["192.168.1.2"]


def test_named_events_are_stored_and_searchable(tmp_path: Path) -> None:
    path = tmp_path / "visits.db"
    app = create_app(path)
    visitor = TestClient(app, client=("192.168.1.2", 1234))
    assert visitor.post("/api/visits", json={**payload(), "event": "home"}).status_code == 202
    assert visitor.post("/api/visits", json={**payload(), "event": "start_job"}).status_code == 202
    admin = TestClient(app, client=(visits.VISITS_ADMIN_IP, 1234))
    page = admin.get("/api/visits?search=start_job").json()
    assert page["total"] == 1
    assert page["items"][0]["event"] == "start_job"
    for event in ["", "x" * 65, "bad event"]:
        assert visitor.post("/api/visits", json={**payload(), "event": event}).status_code == 422
    assert len(rows(path)) == 2


def test_existing_visit_database_gets_home_event_without_losing_records(tmp_path: Path) -> None:
    path = tmp_path / "old.db"
    with sqlite3.connect(path) as db:
        db.execute("""CREATE TABLE visits (
            id TEXT PRIMARY KEY, visited_at TEXT NOT NULL, ip TEXT NOT NULL,
            city TEXT, state TEXT, country TEXT, app_version TEXT NOT NULL
        )""")
        db.execute("INSERT INTO visits VALUES (?, ?, ?, ?, ?, ?, ?)", (
            "old-visit", "2026-11-11T12:00:00+00:00", "8.8.8.8", "New York", "NY", "United States", "26.11.11",
        ))
    for _ in range(2):
        store = SessionStore(path)
        result, total = store.browse_visits("", 50, 0)
        assert total == 1
        assert result[0]["id"] == "old-visit"
        assert result[0]["city"] == "New York"
        assert result[0]["event"] == "home"
        assert result[0]["user"] is None


def test_guest_name_is_saved_trimmed_and_searchable(tmp_path: Path) -> None:
    path = tmp_path / "visits.db"
    app = create_app(path)
    visitor = TestClient(app, client=("192.168.1.2", 1234))
    body = {**payload(), "event": "home", "user": "  Jamie Guest  "}
    assert visitor.post("/api/visits", json=body).status_code == 202
    assert visitor.post("/api/visits", json=body).status_code == 202
    assert len(rows(path)) == 1
    assert rows(path)[0]["user"] == "Jamie Guest"
    admin = TestClient(app, client=(visits.VISITS_ADMIN_IP, 1234))
    page = admin.get("/api/visits?search=jamie").json()
    assert page["total"] == 1
    assert page["items"][0]["user"] == "Jamie Guest"
    for user in ["", "   ", "x" * 255]:
        assert visitor.post("/api/visits", json={**payload(), "user": user}).status_code == 422
    assert len(rows(path)) == 1


def test_named_admin_visit_is_still_excluded(tmp_path: Path) -> None:
    path = tmp_path / "visits.db"
    client = TestClient(create_app(path), client=(visits.VISITS_ADMIN_IP, 1234))
    assert client.post("/api/visits", json={**payload(), "user": "Owner"}).json() == {"status": "excluded"}
    assert rows(path) == []


def test_user_migration_preserves_existing_named_event(tmp_path: Path) -> None:
    path = tmp_path / "events.db"
    with sqlite3.connect(path) as db:
        db.execute("""CREATE TABLE visits (
            id TEXT PRIMARY KEY, visited_at TEXT NOT NULL, ip TEXT NOT NULL,
            city TEXT, state TEXT, country TEXT, app_version TEXT NOT NULL,
            event TEXT NOT NULL DEFAULT 'home'
        )""")
        db.execute("INSERT INTO visits VALUES (?, ?, ?, ?, ?, ?, ?, ?)", (
            "old-event", "2026-11-11T12:00:00+00:00", "8.8.8.8", None, None, None, "26.11.11", "start_job",
        ))
    store = SessionStore(path)
    result, total = store.browse_visits("", 50, 0)
    assert total == 1
    assert result[0]["event"] == "start_job"
    assert result[0]["user"] is None
