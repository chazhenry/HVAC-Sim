"""Persistent accounts and opaque login sessions; no plaintext passwords or tokens."""
AUTH_SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL COLLATE NOCASE UNIQUE,
    fname TEXT NOT NULL,
    lname TEXT NOT NULL,
    ipaddress TEXT NOT NULL,
    login_count INTEGER NOT NULL DEFAULT 0,
    pw_hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS auth_sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_sessions_expiry ON auth_sessions(expires_at);
CREATE TABLE IF NOT EXISTS auth_attempts (
    ip TEXT NOT NULL,
    email TEXT NOT NULL,
    kind TEXT NOT NULL,
    attempted_at REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_attempts_time ON auth_attempts(attempted_at);
"""

PUBLIC_USER_COLUMNS = "id, email, fname, lname, ipaddress, login_count"


class AuthStoreMixin:
    def consume_auth_attempt(self, ip: str, email: str, kind: str, now: float) -> bool:
        with self._lock, self._db:
            self._db.execute("DELETE FROM auth_attempts WHERE attempted_at < ?", (now - 3600,))
            window, maximum = (3600, 10) if kind == "register" else (900, 30)
            count = self._db.execute("SELECT COUNT(*) FROM auth_attempts WHERE ip = ? AND kind IN (?, ?) AND attempted_at >= ?",
                                     (ip, kind, 'login-success' if kind == 'login' else kind, now - window)).fetchone()[0]
            account = self._db.execute("SELECT COUNT(*) FROM auth_attempts WHERE ip = ? AND email = ? AND kind = 'login' AND attempted_at >= ?",
                                       (ip, email, now - 900)).fetchone()[0]
            if count >= maximum or kind == "login" and account >= 5:
                return False
            self._db.execute("INSERT INTO auth_attempts VALUES (?, ?, ?, ?)", (ip, email, kind, now))
        return True

    def user_credentials(self, email: str) -> dict | None:
        with self._lock:
            row = self._db.execute("SELECT id, pw_hash FROM users WHERE email = ?", (email,)).fetchone()
        return dict(row) if row else None

    def register_user(self, email: str, fname: str, lname: str, ip: str, pw_hash: str, token_hash: str, expires: float) -> dict:
        with self._lock, self._db:
            cursor = self._db.execute("INSERT INTO users (email, fname, lname, ipaddress, login_count, pw_hash) VALUES (?, ?, ?, ?, 1, ?)",
                                      (email, fname, lname, ip, pw_hash))
            user_id = cursor.lastrowid
            self._db.execute("INSERT INTO auth_sessions VALUES (?, ?, ?)", (token_hash, user_id, expires))
            row = self._db.execute(f"SELECT {PUBLIC_USER_COLUMNS} FROM users WHERE id = ?", (user_id,)).fetchone()
        return dict(row)

    def login_user(self, user_id: int, ip: str, token_hash: str, expires: float, now: float) -> dict:
        with self._lock, self._db:
            self._db.execute("DELETE FROM auth_sessions WHERE expires_at <= ?", (now,))
            self._db.execute("UPDATE users SET ipaddress = ?, login_count = login_count + 1 WHERE id = ?", (ip, user_id))
            self._db.execute("INSERT INTO auth_sessions VALUES (?, ?, ?)", (token_hash, user_id, expires))
            # Reset consecutive account failures while retaining the IP's attempt budget.
            row = self._db.execute(f"SELECT {PUBLIC_USER_COLUMNS} FROM users WHERE id = ?", (user_id,)).fetchone()
            self._db.execute("UPDATE auth_attempts SET kind = 'login-success' WHERE ip = ? AND email = ? AND kind = 'login'", (ip, row['email']))
        return dict(row)

    def authenticated_user(self, token_hash: str, now: float) -> dict | None:
        with self._lock:
            row = self._db.execute(f"SELECT {', '.join('u.' + c.strip() for c in PUBLIC_USER_COLUMNS.split(','))} "
                                   "FROM auth_sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?",
                                   (token_hash, now)).fetchone()
        return dict(row) if row else None

    def revoke_auth_session(self, token_hash: str) -> None:
        with self._lock, self._db:
            self._db.execute("DELETE FROM auth_sessions WHERE token_hash = ?", (token_hash,))

    def reply_session(self, reply_id: str) -> str | None:
        with self._lock:
            row = self._db.execute("SELECT session_id FROM chat_replies WHERE id = ?", (reply_id,)).fetchone()
        return row[0] if row else None
