import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.SQLITE_DB_PATH || path.resolve('./data/credentials.db');
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS credentials (
    id TEXT PRIMARY KEY,
    data_hash TEXT NOT NULL,
    algorithm TEXT NOT NULL,
    signature TEXT NOT NULL,
    public_key_id TEXT NOT NULL,
    anchor_tx_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    issued_at TEXT NOT NULL,
    idempotency_key TEXT UNIQUE
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    credential_id TEXT,
    action TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    status TEXT NOT NULL,
    details TEXT,
    caller_tier TEXT DEFAULT 'bearer_api_key'
  );
`);

// Indexes for high-performance lookups
db.exec(`CREATE INDEX IF NOT EXISTS idx_credentials_data_hash ON credentials(data_hash);`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp DESC);`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_log_credential_id ON audit_log(credential_id);`);

/**
 * Converts a raw SQLite row (snake_case columns) into a canonical camelCase API shape.
 * All database query functions return through this mapper to eliminate
 * dual snake_case/camelCase fallbacks throughout the codebase.
 */
export function toApiShape(row) {
  if (!row) return null;
  return {
    id: row.id,
    dataHash: row.data_hash,
    algorithm: row.algorithm,
    signature: row.signature,
    publicKeyId: row.public_key_id,
    anchorTxId: row.anchor_tx_id || null,
    status: row.status,
    issuedAt: row.issued_at,
    idempotencyKey: row.idempotency_key || null
  };
}

export function toAuditShape(row) {
  if (!row) return null;
  return {
    id: row.id,
    credentialId: row.credential_id || null,
    action: row.action,
    timestamp: row.timestamp,
    status: row.status,
    details: row.details ? (() => { try { return JSON.parse(row.details); } catch { return row.details; } })() : null,
    callerTier: row.caller_tier || 'bearer_api_key'
  };
}

const stmts = {
  insertCred: db.prepare(`
    INSERT OR IGNORE INTO credentials (id, data_hash, algorithm, signature, public_key_id, anchor_tx_id, status, issued_at, idempotency_key)
    VALUES (@id, @dataHash, @algorithm, @signature, @publicKeyId, @anchorTxId, @status, @issuedAt, @idempotencyKey)
  `),
  getCred: db.prepare('SELECT * FROM credentials WHERE id = ?'),
  getCredByIdempotencyKey: db.prepare('SELECT * FROM credentials WHERE idempotency_key = ?'),
  getCredByDataHash: db.prepare('SELECT * FROM credentials WHERE data_hash = ?'),
  updateStatus: db.prepare('UPDATE credentials SET status = ? WHERE id = ?'),
  updateAnchor: db.prepare('UPDATE credentials SET anchor_tx_id = ?, status = ? WHERE id = ?'),
  getAll: db.prepare('SELECT * FROM credentials ORDER BY issued_at DESC'),
  insertAudit: db.prepare(`
    INSERT INTO audit_log (credential_id, action, timestamp, status, details, caller_tier)
    VALUES (@credentialId, @action, @timestamp, @status, @details, @callerTier)
  `),
  getRecentAudit: db.prepare('SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT ?')
};

export async function createCredential(record) {
  const result = stmts.insertCred.run({
    id: record.id,
    dataHash: record.dataHash,
    algorithm: record.algorithm,
    signature: record.signature,
    publicKeyId: record.publicKeyId,
    anchorTxId: record.anchorTxId || null,
    status: record.status || 'pending',
    issuedAt: record.issuedAt,
    idempotencyKey: record.idempotencyKey || null
  });
  return result;
}

export async function getCredentialById(id) {
  return toApiShape(stmts.getCred.get(id));
}

export async function getCredentialByIdempotencyKey(key) {
  return toApiShape(stmts.getCredByIdempotencyKey.get(key));
}

export async function getCredentialByDataHash(hash) {
  return toApiShape(stmts.getCredByDataHash.get(hash));
}

export async function updateStatus(id, status) {
  stmts.updateStatus.run(status, id);
}

export async function updateAnchorInfo(id, anchorTxId, status) {
  stmts.updateAnchor.run(anchorTxId, status, id);
}

export async function getAllCredentials() {
  return stmts.getAll.all().map(toApiShape);
}

export function recordAuditLog({ credentialId, action, status, details, callerTier = 'bearer_api_key' }) {
  try {
    const timestamp = new Date().toISOString();
    const detailsStr = typeof details === 'object' ? JSON.stringify(details) : (details || null);
    stmts.insertAudit.run({
      credentialId: credentialId || null,
      action,
      timestamp,
      status,
      details: detailsStr,
      callerTier
    });
  } catch (err) {
    console.error('Failed to record audit log:', err.message);
  }
}

export function getAuditLogs(limit = 50) {
  try {
    const safeLimit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 200) : 50;
    return stmts.getRecentAudit.all(safeLimit).map(toAuditShape);
  } catch (err) {
    console.error('Failed to get audit logs:', err.message);
    return [];
  }
}

export function clearDatabase() {
  db.exec('DELETE FROM credentials; DELETE FROM audit_log;');
}
