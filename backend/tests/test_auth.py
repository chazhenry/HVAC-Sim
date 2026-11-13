import hashlib
import sqlite3
import time
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app import auth, llm
from app.main import create_app
from app.store import SCHEMA, SessionStore
from test_api import GOOD_FINAL

PASSWORD = "LearningHVAC!26"
ORIGIN = "http://localhost:5173"


def registration(email="jamie@example.com", **extra):
    return {"email": email, "fname": " Jamie ", "lname": " Trainer ", "password": PASSWORD, "confirmPassword": PASSWORD, **extra}


@pytest.fixture()
def setup(tmp_path):
    path = tmp_path / "auth.db"
    app = create_app(path)
    client = TestClient(app, client=("192.168.20.4", 1234), headers={"Origin": ORIGIN})
    return path, app, client


def sign_up(client, email="jamie@example.com"):
    response = client.post("/api/auth/register", json=registration(email))
    assert response.status_code == 201, response.text
    data = response.json()
    client.headers["Authorization"] = "Bearer " + data["token"]
    return data


def test_registration_table_hash_identity_and_autoincrement(setup):
    path, _, client = setup
    first = sign_up(client, "  JAMIE@example.com  ")
    assert first["user"] == {"id": 1, "email": "jamie@example.com", "fname": "Jamie", "lname": "Trainer", "ipaddress": "192.168.20.4", "loginCount": 1}
    assert client.get("/api/auth/me").json() == first["user"]
    assert client.get("/api/catalog").status_code == 200
    assert first["expiresAt"] > time.time()
    with sqlite3.connect(path) as db:
        columns = {row[1] for row in db.execute("PRAGMA table_info(users)")}
        assert columns == {"id", "email", "fname", "lname", "ipaddress", "login_count", "pw_hash"}
        encoded = db.execute("SELECT pw_hash FROM users").fetchone()[0]
        assert encoded.startswith("scrypt$") and PASSWORD not in encoded
        assert auth.verify_password(PASSWORD, encoded)
        assert db.execute("SELECT token_hash FROM auth_sessions").fetchone()[0] == hashlib.sha256(first["token"].encode()).hexdigest()
        assert "AUTOINCREMENT" in db.execute("SELECT sql FROM sqlite_master WHERE name='users'").fetchone()[0]
    second = sign_up(client, "second@example.com")
    assert second["user"]["id"] == 2
    assert client.post("/api/auth/register", json=registration("JAMIE@EXAMPLE.COM")).status_code == 409


def test_login_updates_ip_count_and_logout_revokes_token(setup):
    path, app, client = setup
    user = sign_up(client)
    assert client.post("/api/auth/logout").status_code == 204
    assert client.get("/api/auth/me").status_code == 401
    other = TestClient(app, client=("192.168.20.5", 1234), headers={"Origin": ORIGIN})
    logged_in = other.post("/api/auth/login", json={"email": "JAMIE@example.com", "password": PASSWORD})
    assert logged_in.status_code == 200
    data = logged_in.json()
    assert data["user"]["id"] == user["user"]["id"]
    assert data["user"]["loginCount"] == 2 and data["user"]["ipaddress"] == "192.168.20.5"
    other.headers["Authorization"] = "Bearer " + data["token"]
    assert other.get("/api/auth/me").json()["loginCount"] == 2
    with sqlite3.connect(path) as db:
        assert db.execute("SELECT login_count FROM users").fetchone()[0] == 2
        db.execute("UPDATE auth_sessions SET expires_at = ?", (time.time() - 1,))
    assert other.get("/api/auth/me").status_code == 401
    assert other.get("/api/catalog").status_code == 401
    assert client.get("/api/health").status_code == 200


@pytest.mark.parametrize("patch", [
    {"password": "Short1!", "confirmPassword": "Short1!"},
    {"password": "alllowercase26!", "confirmPassword": "alllowercase26!"},
    {"password": "ALLUPPERCASE26!", "confirmPassword": "ALLUPPERCASE26!"},
    {"password": "NoNumbersHere!", "confirmPassword": "NoNumbersHere!"},
    {"password": "NoSymbolsHere26", "confirmPassword": "NoSymbolsHere26"},
    {"password": "A" * 129 + "a1!", "confirmPassword": "A" * 129 + "a1!"},
    {"password": "LearningHVAC!26\n", "confirmPassword": "LearningHVAC!26\n"},
    {"confirmPassword": "DifferentHVAC!26"}, {"email": "not-an-email"}, {"fname": " "}, {"lname": " "},
])
def test_registration_validates_password_confirmation_email_and_names_without_echoing_secrets(setup, patch):
    path, _, client = setup
    body = registration(**patch)
    response = client.post("/api/auth/register", json=body)
    assert response.status_code == 422
    assert body["password"] not in response.text and body["confirmPassword"] not in response.text
    with sqlite3.connect(path) as db:
        assert db.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0


def test_hashing_uses_independent_salts_and_constant_format():
    a = auth.hash_password(PASSWORD); b = auth.hash_password(PASSWORD)
    assert a != b
    assert auth.verify_password(PASSWORD, a)
    assert not auth.verify_password("wrong-password", a)
    assert not auth.verify_password(PASSWORD, "broken")
    assert not auth.verify_password(PASSWORD, "scrypt$999999999$8$3$AAAA$AAAA")


def test_unauthenticated_requests_and_unknown_origins_are_rejected(setup):
    _, _, client = setup
    for path in ("/api/catalog", "/api/history", "/api/auth/me", "/api/visits/access", "/api/exam"):
        assert client.get(path).status_code == 401
    bad = client.post("/api/auth/register", json=registration(), headers={"Origin": "https://evil.example"})
    assert bad.status_code == 403
    client.headers.pop("Origin")
    assert client.post("/api/auth/register", json=registration()).status_code == 403
    assert client.get("/api/auth/me", headers={"Authorization": "Bearer " + "invalid" * 10}).status_code == 401
    preflight = client.options("/api/catalog", headers={"Origin": ORIGIN, "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "Authorization"})
    assert preflight.status_code == 200
    unauthorized = client.get("/api/catalog", headers={"Origin": ORIGIN})
    assert unauthorized.headers["access-control-allow-origin"] == ORIGIN


def test_login_errors_are_generic_and_rate_limited(setup, monkeypatch):
    _, _, client = setup
    sign_up(client)
    real = client.post("/api/auth/login", json={"email": "jamie@example.com", "password": "incorrect"})
    missing = client.post("/api/auth/login", json={"email": "missing@example.com", "password": "incorrect"})
    assert real.status_code == missing.status_code == 401 and real.json() == missing.json()
    monkeypatch.setattr(auth, "verify_password", lambda *args: False)
    for _ in range(4):
        assert client.post("/api/auth/login", json={"email": "missing@example.com", "password": "incorrect"}).status_code == 401
    limited = client.post("/api/auth/login", json={"email": "missing@example.com", "password": "incorrect"})
    assert limited.status_code == 429 and limited.headers["Retry-After"] == "900"


def test_sessions_history_feedback_and_visits_use_authenticated_identity(setup, monkeypatch):
    path, app, first = setup
    owner = sign_up(first)
    async def complete(messages):
        return "Use the meter.", "test"
    monkeypatch.setattr(llm, "complete", complete)
    session = first.post("/api/sessions", json={"scenarioId": "orientation"}).json()["sessionId"]
    reply = first.post(f"/api/sessions/{session}/chat", json={"message": "What next?"}).json()
    feedback = {"replyId": reply["replyId"], "rating": "up", "explanation": "Clear", "user": "forged@example.com"}
    assert first.post("/api/feedback", json=feedback).status_code == 201
    assert first.post("/api/visits", json={"visitId": str(uuid4()), "appVersion": "test", "user": "forged@example.com"}).status_code == 202
    assert first.post(f"/api/sessions/{session}/submit", json={"diagnosisId": "no_fault", "finalState": GOOD_FINAL}).status_code == 200
    other = TestClient(app, client=("192.168.20.6", 1234), headers={"Origin": ORIGIN})
    sign_up(other, "other@example.com")
    assert other.post(f"/api/sessions/{session}/hint").status_code == 404
    assert other.post("/api/feedback", json=feedback).status_code == 404
    assert other.get("/api/history").json() == []
    assert len(first.get("/api/history").json()) == 1
    with sqlite3.connect(path) as db:
        assert db.execute("SELECT user, user_id FROM feedback").fetchone() == (owner["user"]["email"], owner["user"]["id"])
        assert db.execute("SELECT user, user_id FROM visits").fetchone() == (owner["user"]["email"], owner["user"]["id"])


def test_admin_visits_remain_excluded_and_optional_invites_are_enforced(setup, monkeypatch):
    path, app, _ = setup
    monkeypatch.setenv("HVAC_SIM_ALLOWED_EMAILS", "invited@example.com")
    admin = TestClient(app, client=("127.0.0.1", 1234), headers={"Origin": ORIGIN})
    assert admin.post("/api/auth/register", json=registration()).status_code == 403
    sign_up(admin, "invited@example.com")
    assert admin.get("/api/visits/access").json()["allowed"] is True
    assert admin.post("/api/visits", json={"visitId": str(uuid4()), "appVersion": "test"}).json()["status"] == "excluded"
    with sqlite3.connect(path) as db:
        assert db.execute("SELECT COUNT(*) FROM visits").fetchone()[0] == 0


def test_existing_database_is_upgraded_without_losing_history(tmp_path):
    path = tmp_path / "old.db"
    with sqlite3.connect(path) as db:
        db.executescript(SCHEMA)
        db.execute("INSERT INTO sessions (id, scenario_id, started_at) VALUES ('old', 'orientation', 'before')")
    store = SessionStore(path)
    assert store.get('old').user_id is None
    with sqlite3.connect(path) as db:
        for table in ('sessions', 'feedback', 'visits'):
            assert 'user_id' in {row[1] for row in db.execute(f'PRAGMA table_info({table})')}
        assert db.execute("SELECT started_at FROM sessions WHERE id = 'old'").fetchone()[0] == 'before'
