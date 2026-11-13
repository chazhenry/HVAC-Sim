"""Email/password authentication with scrypt and expiring, revocable bearer sessions."""
import base64
import hashlib
import hmac
import os
import re
import secrets
import sqlite3
import time
import threading

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import Field, SecretStr, field_validator, model_validator

from .models import ApiModel
from .store import SessionStore

SESSION_SECONDS = 12 * 60 * 60
PUBLIC_PATHS = frozenset({"/api/health", "/api/auth/register", "/api/auth/login"})
PASSWORD_WORKERS = threading.BoundedSemaphore(4)


def password_problem(password: str) -> str | None:
    if not 12 <= len(password) <= 128:
        return "Use 12–128 characters for your password."
    if any(ord(c) < 32 or ord(c) == 127 for c in password):
        return "Passwords cannot contain control characters."
    if not all(re.search(pattern, password) for pattern in (r"[a-z]", r"[A-Z]", r"[0-9]", r"[^A-Za-z0-9\s]")):
        return "Include an uppercase letter, lowercase letter, number and symbol."
    return None


def hash_password(password: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    with PASSWORD_WORKERS:
        derived = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2**15, r=8, p=3, maxmem=64 * 1024 * 1024, dklen=32)
    return "scrypt$32768$8$3$" + base64.b64encode(salt).decode() + "$" + base64.b64encode(derived).decode()


def verify_password(password: str, encoded: str) -> bool:
    try:
        algorithm, n, r, p, salt, _ = encoded.split("$")
        if (algorithm, n, r, p) != ("scrypt", "32768", "8", "3"):
            return False
        return hmac.compare_digest(hash_password(password, base64.b64decode(salt, validate=True)), encoded)
    except (ValueError, TypeError):
        return False


DUMMY_HASH = hash_password(secrets.token_urlsafe(32))


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


class LoginRequest(ApiModel):
    email: str = Field(min_length=3, max_length=254)
    password: SecretStr = Field(min_length=1, max_length=128)

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        email = value.strip().lower()
        parts = email.split("@")
        if len(parts) != 2 or len(parts[0]) > 64 or not re.fullmatch(r"[a-z0-9.!#$%&'*+/=?^_`{|}~-]+", parts[0]) or not re.fullmatch(r"[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+", parts[1]):
            raise ValueError("Enter a valid email address.")
        return email


class RegisterRequest(LoginRequest):
    fname: str = Field(min_length=1, max_length=100)
    lname: str = Field(min_length=1, max_length=100)
    confirm_password: SecretStr = Field(min_length=1, max_length=128)

    @field_validator("fname", "lname", mode="before")
    @classmethod
    def trim_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @model_validator(mode="after")
    def valid_password(self):
        password = self.password.get_secret_value()
        if problem := password_problem(password):
            raise ValueError(problem)
        if not hmac.compare_digest(password.encode(), self.confirm_password.get_secret_value().encode()):
            raise ValueError("Passwords do not match.")
        return self


class PublicUser(ApiModel):
    id: int
    email: str
    fname: str
    lname: str
    ipaddress: str
    login_count: int


class AuthResponse(ApiModel):
    user: PublicUser
    token: str
    expires_at: float


def authorize(request: Request, store: SessionStore) -> None:
    kind, _, token = request.headers.get("authorization", "").partition(" ")
    user = store.authenticated_user(token_hash(token), time.time()) if kind.lower() == "bearer" and 20 <= len(token) <= 200 else None
    if user is None:
        raise HTTPException(status_code=401, detail="Please sign in to continue.", headers={"WWW-Authenticate": "Bearer"})
    request.state.auth_user = user
    request.state.auth_token_hash = token_hash(token)


def auth_router(store: SessionStore, origins: list[str]) -> APIRouter:
    router = APIRouter(prefix="/api/auth")

    def check_origin(request: Request) -> None:
        trusted = {*origins, str(request.base_url).rstrip("/")}
        if request.headers.get("origin", "").rstrip("/") not in trusted:
            raise HTTPException(status_code=403, detail="Sign in from the simulator page.")

    def attempt(request: Request, email: str, kind: str) -> str:
        check_origin(request)
        ip = request.client.host if request.client else "unknown"
        if not store.consume_auth_attempt(ip, email, kind, time.time()):
            raise HTTPException(status_code=429, detail="Too many attempts. Please try again later.", headers={"Retry-After": "900"})
        return ip

    @router.post("/register", response_model=AuthResponse, status_code=201)
    def register(body: RegisterRequest, request: Request) -> AuthResponse:
        ip = attempt(request, body.email, "register")
        invited = {email.strip().lower() for email in os.environ.get("HVAC_SIM_ALLOWED_EMAILS", "").split(",") if email.strip()}
        if invited and body.email not in invited:
            raise HTTPException(status_code=403, detail="This email has not been invited to the demo.")
        token = secrets.token_urlsafe(32)
        expires = time.time() + SESSION_SECONDS
        try:
            user = store.register_user(body.email, body.fname, body.lname, ip, hash_password(body.password.get_secret_value()), token_hash(token), expires)
        except sqlite3.IntegrityError:
            raise HTTPException(status_code=409, detail="An account with this email already exists. Please sign in.") from None
        return AuthResponse(user=PublicUser.model_validate(user), token=token, expires_at=expires)

    @router.post("/login", response_model=AuthResponse)
    def login(body: LoginRequest, request: Request) -> AuthResponse:
        ip = attempt(request, body.email, "login")
        credentials = store.user_credentials(body.email)
        correct = verify_password(body.password.get_secret_value(), credentials["pw_hash"] if credentials else DUMMY_HASH)
        if not credentials or not correct:
            raise HTTPException(status_code=401, detail="Email or password is incorrect.")
        token = secrets.token_urlsafe(32)
        now = time.time()
        expires = now + SESSION_SECONDS
        user = store.login_user(credentials["id"], ip, token_hash(token), expires, now)
        return AuthResponse(user=PublicUser.model_validate(user), token=token, expires_at=expires)

    @router.get("/me", response_model=PublicUser)
    def me(request: Request) -> PublicUser:
        return PublicUser.model_validate(request.state.auth_user)

    @router.post("/logout", status_code=204)
    def logout(request: Request) -> Response:
        store.revoke_auth_session(request.state.auth_token_hash)
        return Response(status_code=204, headers={"Cache-Control": "no-store"})

    return router
