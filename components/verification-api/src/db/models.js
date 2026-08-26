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
`);

const stmts = {
  insertCred: db.prepare(`
    INSERT OR IGNORE INTO credentials (id, data_hash, algorithm, signature, public_key_id, anchor_tx_id, status, issued_at, idempotency_key)
    VALUES (@id, @dataHash, @algorithm, @signature, @publicKeyId, @anchorTxId, @status, @issuedAt, @idempotencyKey)
  `),
  getCred: db.prepare('SELECT * FROM credentials WHERE id = ?'),
  getCredByIdempotencyKey: db.prepare('SELECT * FROM credentials WHERE idempotency_key = ?'),
  updateStatus: db.prepare('UPDATE credentials SET status = ? WHERE id = ?'),
  updateAnchor: db.prepare('UPDATE credentials SET anchor_tx_id = ?, status = ? WHERE id = ?'),
  getAll: db.prepare('SELECT * FROM credentials ORDER BY issued_at DESC')
};

export async function createCredential(record) {
  stmts.insertCred.run({
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
  return [];
}

export async function getCredentialById(id) {
  return stmts.getCred.get(id);
}

export async function getCredentialByIdempotencyKey(key) {
  return stmts.getCredByIdempotencyKey.get(key);
}

export async function updateStatus(id, status) {
  stmts.updateStatus.run(status, id);
}

export async function updateAnchorInfo(id, anchorTxId, status) {
  stmts.updateAnchor.run(anchorTxId, status, id);
}

export async function getAllCredentials() {
  return stmts.getAll.all();
}
