import Database from 'better-sqlite3';
import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';

const DB_DIR = process.env.DB_DIR || (fs.existsSync('/app/data') ? '/app/data' : path.resolve(process.cwd(), 'data'));
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const keysDbPath = path.join(DB_DIR, 'gateway_system.db');
const keysDb = new Database(keysDbPath);

// Initialize system API keys schema
keysDb.exec(`
  CREATE TABLE IF NOT EXISTS api_keys (
    api_key_hash TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    tier TEXT NOT NULL DEFAULT 'standard',
    quota_limit INTEGER NOT NULL DEFAULT 10000,
    quota_used INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
`);

// Seed default test key if empty
const seedStmt = keysDb.prepare('SELECT COUNT(*) as count FROM api_keys');
const { count } = seedStmt.get();
if (count === 0) {
  const insertStmt = keysDb.prepare(`
    INSERT INTO api_keys (api_key_hash, tenant_id, tier, quota_limit, quota_used, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  // Seed 'scatterid-test-api-key-999' -> default-tenant
  const defaultKeyHash = createHash('sha256').update('scatterid-test-api-key-999').digest('hex');
  insertStmt.run(defaultKeyHash, 'default-tenant', 'enterprise', 100000, 0, new Date().toISOString());

  // Seed 'scatterid-tenant-a-key-111' -> tenant-a
  const keyAHash = createHash('sha256').update('scatterid-tenant-a-key-111').digest('hex');
  insertStmt.run(keyAHash, 'tenant-a', 'standard', 10000, 0, new Date().toISOString());

  // Seed 'scatterid-tenant-b-key-222' -> tenant-b
  const keyBHash = createHash('sha256').update('scatterid-tenant-b-key-222').digest('hex');
  insertStmt.run(keyBHash, 'tenant-b', 'standard', 10000, 0, new Date().toISOString());
  
  console.log('[+] Seeded default testing api keys successfully.');
}

const getApiKeyStmt = keysDb.prepare(`
  SELECT tenant_id, tier, quota_limit, quota_used FROM api_keys WHERE api_key_hash = ?
`);

export function getTenantByKey(apiKey) {
  try {
    const hashed = createHash('sha256').update(apiKey).digest('hex');
    const row = getApiKeyStmt.get(hashed);
    return row || null;
  } catch (err) {
    console.error('Failed to get tenant by key:', err.message);
    return null;
  }
}

export function rotateTenantKey(tenantId) {
  try {
    const randomBytes = Math.random().toString(36).substring(2, 12);
    const newKey = `scatterid-${tenantId}-key-${randomBytes}`;
    const newHashed = createHash('sha256').update(newKey).digest('hex');
    
    const updateStmt = keysDb.prepare('UPDATE api_keys SET api_key_hash = ? WHERE tenant_id = ?');
    updateStmt.run(newHashed, tenantId);
    
    return {
      newKeyPlaintext: newKey,
      newKeyHashed: newHashed
    };
  } catch (err) {
    console.error('Failed to rotate tenant key in SQLite:', err.message);
    return null;
  }
}
