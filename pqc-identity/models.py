"""
models.py — Database layer for PQC-DID Identity System
SQLite-backed, no ORM — keep it transparent and auditable.
"""
import sqlite3
import os
import time
import secrets

DB_PATH     = os.path.join(os.path.dirname(__file__), "db", "identity.db")
UNI_DOMAIN  = "kfueit.edu.pk"

def roll_to_email(roll_no: str) -> str:
    """Derive university email from roll number."""
    return f"{roll_no.strip().lower()}@{UNI_DOMAIN}"

def email_to_roll(email: str) -> str:
    """Extract roll number from university email."""
    return email.split("@")[0]

def get_db():
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA journal_mode=WAL")
    db.execute("PRAGMA foreign_keys=ON")
    return db

def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    db = get_db()
    db.executescript("""
        CREATE TABLE IF NOT EXISTS signup_requests (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name   TEXT NOT NULL,
            email       TEXT NOT NULL UNIQUE,
            roll_no     TEXT,
            student_id  TEXT NOT NULL,
            did         TEXT NOT NULL UNIQUE,
            pubkey_hex  TEXT NOT NULL,
            status      TEXT NOT NULL DEFAULT 'pending',
            created_at  INTEGER NOT NULL,
            reviewed_at INTEGER,
            reviewed_by TEXT
        );

        CREATE TABLE IF NOT EXISTS users (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            did         TEXT NOT NULL UNIQUE,
            email       TEXT NOT NULL UNIQUE,
            full_name   TEXT NOT NULL,
            student_id  TEXT,
            role        TEXT NOT NULL DEFAULT 'student',
            pubkey_hex  TEXT NOT NULL,
            created_at  INTEGER NOT NULL,
            last_login  INTEGER
        );

        CREATE TABLE IF NOT EXISTS challenges (
            challenge_hex TEXT PRIMARY KEY,
            did           TEXT NOT NULL,
            created_at    INTEGER NOT NULL,
            expires_at    INTEGER NOT NULL,
            used          INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS audit_log (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            event       TEXT NOT NULL,
            did         TEXT,
            ip          TEXT,
            detail      TEXT,
            ts          INTEGER NOT NULL
        );
    """)
    db.commit()
    db.close()

# ── Signup Requests ────────────────────────────────────────────────────────────

def create_signup_request(full_name, email, student_id, did, pubkey_hex, roll_no=None):
    db = get_db()
    roll = roll_no or email_to_roll(email)
    try:
        db.execute(
            "INSERT INTO signup_requests "
            "(full_name, email, roll_no, student_id, did, pubkey_hex, status, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)",
            (full_name, email, roll, student_id, did, pubkey_hex, int(time.time()))
        )
        db.commit()
        return True, None
    except sqlite3.IntegrityError:
        return False, "Email or DID already registered."
    finally:
        db.close()

def get_pending_requests():
    db = get_db()
    rows = db.execute(
        "SELECT * FROM signup_requests WHERE status='pending' ORDER BY created_at DESC"
    ).fetchall()
    db.close()
    return [dict(r) for r in rows]

def get_all_requests():
    db = get_db()
    rows = db.execute(
        "SELECT * FROM signup_requests ORDER BY created_at DESC"
    ).fetchall()
    db.close()
    return [dict(r) for r in rows]

def update_request_status(request_id, status, reviewed_by):
    db = get_db()
    db.execute(
        "UPDATE signup_requests SET status=?, reviewed_at=?, reviewed_by=? WHERE id=?",
        (status, int(time.time()), reviewed_by, request_id)
    )
    db.commit()
    req = db.execute("SELECT * FROM signup_requests WHERE id=?", (request_id,)).fetchone()
    db.close()
    return dict(req) if req else None

# ── Users ──────────────────────────────────────────────────────────────────────

def create_user(did, email, full_name, student_id, pubkey_hex, role="student"):
    db = get_db()
    try:
        db.execute(
            "INSERT INTO users (did, email, full_name, student_id, role, pubkey_hex, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (did, email, full_name, student_id, role, pubkey_hex, int(time.time()))
        )
        db.commit()
        return True
    except sqlite3.IntegrityError:
        return False
    finally:
        db.close()

def get_user_by_did(did):
    db = get_db()
    row = db.execute("SELECT * FROM users WHERE did=?", (did,)).fetchone()
    db.close()
    return dict(row) if row else None

def get_user_by_email(email):
    db = get_db()
    row = db.execute("SELECT * FROM users WHERE email=?", (email.lower(),)).fetchone()
    db.close()
    return dict(row) if row else None

def get_user_by_roll_no(roll_no):
    """Look up a user by their university roll number."""
    return get_user_by_email(roll_to_email(roll_no))

def get_user_by_student_id(student_id):
    db = get_db()
    row = db.execute("SELECT * FROM users WHERE student_id=?", (student_id,)).fetchone()
    db.close()
    return dict(row) if row else None

def get_all_users():
    db = get_db()
    rows = db.execute("SELECT * FROM users ORDER BY created_at DESC").fetchall()
    db.close()
    return [dict(r) for r in rows]

def delete_user(did):
    """Hard delete a user to revoke their access."""
    db = get_db()
    try:
        # Also delete any pending challenges to be fully clean
        db.execute("DELETE FROM challenges WHERE did=?", (did,))
        db.execute("DELETE FROM users WHERE did=?", (did,))
        db.commit()
        return True
    except Exception:
        return False
    finally:
        db.close()

def update_last_login(did):
    db = get_db()
    db.execute("UPDATE users SET last_login=? WHERE did=?", (int(time.time()), did))
    db.commit()
    db.close()

# ── Challenges ─────────────────────────────────────────────────────────────────

def create_challenge(did, ttl=120):
    challenge = secrets.token_hex(32)
    now = int(time.time())
    db = get_db()
    # Clean stale challenges for this DID
    db.execute("DELETE FROM challenges WHERE did=? OR expires_at<?", (did, now))
    db.execute(
        "INSERT INTO challenges (challenge_hex, did, created_at, expires_at, used) VALUES (?, ?, ?, ?, 0)",
        (challenge, did, now, now + ttl)
    )
    db.commit()
    db.close()
    return challenge

def consume_challenge(challenge_hex, did):
    """Returns True if challenge is valid+unused+unexpired for the given DID."""
    now = int(time.time())
    db = get_db()
    row = db.execute(
        "SELECT * FROM challenges WHERE challenge_hex=? AND did=? AND used=0 AND expires_at>?",
        (challenge_hex, did, now)
    ).fetchone()
    if row:
        db.execute("UPDATE challenges SET used=1 WHERE challenge_hex=?", (challenge_hex,))
        db.commit()
    db.close()
    return row is not None

# ── Audit Log ──────────────────────────────────────────────────────────────────

def log_event(event, did=None, ip=None, detail=None):
    db = get_db()
    db.execute(
        "INSERT INTO audit_log (event, did, ip, detail, ts) VALUES (?, ?, ?, ?, ?)",
        (event, did, ip, detail, int(time.time()))
    )
    db.commit()
    db.close()

def get_recent_events(limit=50):
    db = get_db()
    rows = db.execute(
        "SELECT * FROM audit_log ORDER BY ts DESC LIMIT ?", (limit,)
    ).fetchall()
    db.close()
    return [dict(r) for r in rows]

def get_all_events():
    db = get_db()
    rows = db.execute("SELECT * FROM audit_log ORDER BY ts DESC").fetchall()
    db.close()
    return [dict(r) for r in rows]
