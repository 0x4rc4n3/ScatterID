// Migration 001: Initial Ops, Access Control, Requests Queue & PQC Lifecycle Schema
// Document ID: DEV-ARCH-08

export const version = '001';
export const name = 'initial_ops_schema';

export function up(db) {
  const ddl = `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('clerk', 'mod', 'root')),
      station_id TEXT DEFAULT NULL,
      totp_secret TEXT DEFAULT NULL,
      totp_enabled INTEGER NOT NULL DEFAULT 0 CHECK (totp_enabled IN (0, 1)),
      force_password_reset INTEGER NOT NULL DEFAULT 0 CHECK (force_password_reset IN (0, 1)),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

    CREATE TABLE IF NOT EXISTS recovery_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      code_hash TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0 CHECK (used IN (0, 1)),
      used_at TEXT DEFAULT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_recovery_codes_user_id ON recovery_codes(user_id);
    CREATE INDEX IF NOT EXISTS idx_recovery_codes_code_hash ON recovery_codes(code_hash);

    CREATE TABLE IF NOT EXISTS requests (
      id TEXT PRIMARY KEY,
      request_type TEXT NOT NULL CHECK (request_type IN ('issuance', 'revocation', 'key_rotation')),
      submission_channel TEXT NOT NULL CHECK (submission_channel IN ('hard', 'soft', 'routine_internal', 'emergency_internal')),
      status TEXT NOT NULL CHECK (status IN ('PENDING', 'AWAITING_ROOT_ACCEPT', 'FLAGGED', 'EXECUTED', 'REJECTED')),
      claimant_data TEXT DEFAULT NULL,
      credential_id TEXT DEFAULT NULL,
      reason TEXT DEFAULT NULL,
      inspection_checklist_verified INTEGER NOT NULL DEFAULT 0 CHECK (inspection_checklist_verified IN (0, 1)),
      evidence_sha256 TEXT DEFAULT NULL,
      evidence_payload_path TEXT DEFAULT NULL,
      clerk_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      clerk_username TEXT DEFAULT NULL,
      station_id TEXT DEFAULT NULL,
      client_ip TEXT DEFAULT NULL,
      moderator_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      moderator_username TEXT DEFAULT NULL,
      moderator_action TEXT DEFAULT NULL CHECK (moderator_action IN ('APPROVE', 'REJECT', 'FLAG', NULL)),
      moderator_decision_at TEXT DEFAULT NULL,
      moderator_reason TEXT DEFAULT NULL,
      root_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      root_username TEXT DEFAULT NULL,
      root_action TEXT DEFAULT NULL CHECK (root_action IN ('ACCEPT', 'REJECT', NULL)),
      root_decision_at TEXT DEFAULT NULL,
      execution_tx_id TEXT DEFAULT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
    CREATE INDEX IF NOT EXISTS idx_requests_submission_channel ON requests(submission_channel);
    CREATE INDEX IF NOT EXISTS idx_requests_request_type ON requests(request_type);
    CREATE INDEX IF NOT EXISTS idx_requests_created_at ON requests(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_requests_clerk_id ON requests(clerk_id);
    CREATE INDEX IF NOT EXISTS idx_requests_moderator_id ON requests(moderator_id);

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      action TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'FAILURE', 'DENIED', 'PENDING', 'ALERT')),
      actor_id TEXT DEFAULT NULL,
      username TEXT DEFAULT NULL,
      role TEXT DEFAULT NULL,
      station_id TEXT DEFAULT NULL,
      client_ip TEXT DEFAULT NULL,
      request_id TEXT REFERENCES requests(id) ON DELETE SET NULL,
      credential_id TEXT DEFAULT NULL,
      submission_channel TEXT DEFAULT NULL,
      details TEXT DEFAULT NULL,
      caller_tier TEXT DEFAULT 'staff_session'
    );

    CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_log_actor_id ON audit_log(actor_id);
    CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
    CREATE INDEX IF NOT EXISTS idx_audit_log_request_id ON audit_log(request_id);
    CREATE INDEX IF NOT EXISTS idx_audit_log_credential_id ON audit_log(credential_id);

    CREATE TABLE IF NOT EXISTS gateway_keys (
      id TEXT PRIMARY KEY,
      key_name TEXT NOT NULL CHECK (key_name IN ('REVOKE_API_KEY', 'VERIFICATION_API_KEY')),
      key_hash TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('active', 'grace', 'revoked')),
      created_at TEXT NOT NULL,
      grace_expires_at TEXT DEFAULT NULL,
      revoked_at TEXT DEFAULT NULL,
      created_by TEXT REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_gateway_keys_name_status ON gateway_keys(key_name, status);
    CREATE INDEX IF NOT EXISTS idx_gateway_keys_hash ON gateway_keys(key_hash);

    CREATE TABLE IF NOT EXISTS pqc_key_pool (
      key_id TEXT PRIMARY KEY,
      algorithm TEXT NOT NULL DEFAULT 'ML-DSA-87',
      public_key_hex TEXT NOT NULL,
      public_key_id_sha3 TEXT NOT NULL,
      encrypted_private_key TEXT DEFAULT NULL,
      status TEXT NOT NULL CHECK (status IN ('pre_staged', 'active', 'retired', 'compromised')),
      active_from TEXT NOT NULL,
      valid_until TEXT DEFAULT NULL,
      sequence_number INTEGER NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_pqc_key_pool_status ON pqc_key_pool(status);
    CREATE INDEX IF NOT EXISTS idx_pqc_key_pool_sequence ON pqc_key_pool(sequence_number);

    CREATE TABLE IF NOT EXISTS delegation_endorsements (
      id TEXT PRIMARY KEY,
      endorsing_key_id TEXT NOT NULL REFERENCES pqc_key_pool(key_id) ON DELETE RESTRICT,
      delegated_key_id TEXT NOT NULL,
      delegated_public_key_hex TEXT NOT NULL,
      valid_from TEXT NOT NULL,
      valid_until TEXT NOT NULL,
      reason TEXT NOT NULL,
      nonce TEXT NOT NULL,
      signature_by_endorser TEXT NOT NULL,
      created_at TEXT NOT NULL,
      created_by TEXT REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_delegation_endorsements_endorsing ON delegation_endorsements(endorsing_key_id);
    CREATE INDEX IF NOT EXISTS idx_delegation_endorsements_delegated ON delegation_endorsements(delegated_key_id);
  `;

  db.exec(ddl);
}

export function down(db) {
  const rollbackSql = `
    DROP TABLE IF EXISTS delegation_endorsements;
    DROP TABLE IF EXISTS pqc_key_pool;
    DROP TABLE IF EXISTS gateway_keys;
    DROP TABLE IF EXISTS audit_log;
    DROP TABLE IF EXISTS requests;
    DROP TABLE IF EXISTS recovery_codes;
    DROP TABLE IF EXISTS users;
  `;
  db.exec(rollbackSql);
}
