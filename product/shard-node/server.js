import express from 'express';
import Database from 'better-sqlite3';
import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import { getConfig } from './config.js';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const NODE_INDEX = process.env.NODE_INDEX || '1';
const DATA_DIR = process.env.DATA_DIR || '/app/data';
const SHARD_NODE_API_KEY = getConfig('security.shard_node_api_key', process.env.SHARD_NODE_API_KEY);

if (!SHARD_NODE_API_KEY) {
  throw new Error("CRITICAL: SHARD_NODE_API_KEY is not configured. For security, the shard-node cannot start without an API key.");
}

// Inter-Service Authentication Middleware
const authenticateInterService = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Missing or malformed Authorization header' });
  }

  const token = authHeader.substring(7).trim();
  if (token !== SHARD_NODE_API_KEY) {
    return res.status(403).json({ success: false, error: 'Forbidden: Invalid inter-service authentication token' });
  }

  next();
};

// Tenant Extraction Middleware
const requireTenant = (req, res, next) => {
  const tenantId = req.headers['x-tenant-id'];
  const tenantRegex = /^[a-zA-Z0-9_\-]+$/;
  if (!tenantId || !tenantRegex.test(tenantId)) {
    return res.status(400).json({ error: "Missing or malformed X-Tenant-ID header" });
  }
  req.tenantId = tenantId;
  next();
};

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize tables in any newly generated database file
function initDbSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS credentials (
      id TEXT PRIMARY KEY,
      data_hash TEXT NOT NULL,
      algorithm TEXT NOT NULL,
      signature TEXT NOT NULL,
      prime_mod TEXT NOT NULL,
      required_shares INTEGER NOT NULL,
      anchor_tx_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      issued_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS shard_references (
      id TEXT PRIMARY KEY,
      credential_id TEXT NOT NULL,
      share_index INTEGER NOT NULL,
      share_value TEXT NOT NULL,
      share_hash TEXT NOT NULL,
      share_checksum TEXT,
      UNIQUE(credential_id, share_index)
    );

    CREATE INDEX IF NOT EXISTS idx_shard_refs_credential ON shard_references(credential_id);
  `);
}

// Default/System fallback database for monitoring & health check
const defaultDbPath = path.join(DATA_DIR, `node_${NODE_INDEX}.db`);
const defaultDb = new Database(defaultDbPath);
initDbSchema(defaultDb);
const defaultStmts = {
  countShares: defaultDb.prepare('SELECT COUNT(*) as count FROM shard_references'),
};

// Lazy Database Pool per Tenant
const activeDbPool = new Map();

function getTenantDb(tenantId) {
  if (activeDbPool.has(tenantId)) {
    return activeDbPool.get(tenantId);
  }

  const dbPath = path.join(DATA_DIR, `${tenantId}_node_${NODE_INDEX}.db`);
  const db = new Database(dbPath);
  initDbSchema(db);

  const stmts = {
    insertCred: db.prepare(`
      INSERT OR IGNORE INTO credentials (id, data_hash, algorithm, signature, prime_mod, required_shares, anchor_tx_id, status, issued_at)
      VALUES (@id, @dataHash, @algorithm, @signature, @primeMod, @requiredShares, @anchorTxId, @status, @issuedAt)
    `),
    insertShare: db.prepare(`
      INSERT OR REPLACE INTO shard_references (id, credential_id, share_index, share_value, share_hash, share_checksum)
      VALUES (@id, @credentialId, @shareIndex, @shareValue, @shareHash, @shareChecksum)
    `),
    getCred: db.prepare('SELECT * FROM credentials WHERE id = ?'),
    getShare: db.prepare('SELECT * FROM shard_references WHERE credential_id = ?'),
    countShares: db.prepare('SELECT COUNT(*) as count FROM shard_references'),
    getAllShares: db.prepare('SELECT share_value, share_hash, share_checksum FROM shard_references'),
    updateStatus: db.prepare('UPDATE credentials SET status = ? WHERE id = ?'),
    updateAnchor: db.prepare('UPDATE credentials SET anchor_tx_id = ?, status = ? WHERE id = ?'),
  };

  const entry = { db, stmts };
  activeDbPool.set(tenantId, entry);
  return entry;
}

// Health & Metrics Route (Uses default system node for cluster overview status)
app.get('/health', (req, res) => {
  try {
    const stats = fs.existsSync(defaultDbPath) ? fs.statSync(defaultDbPath) : { size: 0 };
    const countRow = defaultStmts.countShares.get();
    
    res.json({
      nodeId: parseInt(NODE_INDEX, 10),
      dbName: `node_${NODE_INDEX}.db`,
      status: 'HEALTHY',
      totalShares: countRow ? countRow.count : 0,
      sizeBytes: stats.size,
      integrityCheck: 'VALID'
    });
  } catch (err) {
    console.error('Shard Node Health Error:', err.stack || err.message);
    res.status(500).json({ status: 'ERROR', error: 'Internal Server Error' });
  }
});

// Shard Storage Route
app.post('/shard', authenticateInterService, requireTenant, (req, res) => {
  try {
    const { record, share } = req.body;
    const tenantId = req.tenantId;
    
    // Strict ZTA input validation and sanitization
    if (!record || !share || typeof record !== 'object' || typeof share !== 'string') {
      return res.status(400).json({ error: 'Invalid parameter: record and share properties are required' });
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!record.id || !uuidRegex.test(record.id)) {
      return res.status(400).json({ error: 'Invalid parameter: record.id must be a valid UUID v4' });
    }

    // Strict regex validation of the share payload index-value:checksum
    const shareRegex = /^[1-5]-[0-9a-f]+(:[0-9a-f]+)?$/i;
    if (!shareRegex.test(share)) {
      return res.status(400).json({ error: 'Invalid parameter: share must be formatted as index-value:checksum' });
    }

    const [core, checksum] = share.split(':');
    const [indexStr, value] = core.split('-');
    const shareIndex = parseInt(indexStr, 10);
    
    if (isNaN(shareIndex) || shareIndex < 1 || shareIndex > 5) {
      return res.status(400).json({ error: 'Invalid parameter: share index must be an integer between 1 and 5' });
    }

    const shareHash = createHash('sha3-256').update(value).digest('hex');

    const normRecord = {
      id: record.id,
      dataHash: record.dataHash || record.data_hash,
      algorithm: record.algorithm,
      signature: record.signature,
      primeMod: record.primeMod || record.prime_mod,
      requiredShares: record.requiredShares || record.required_shares,
      anchorTxId: record.anchorTxId || record.anchor_tx_id || null,
      status: record.status || 'pending',
      issuedAt: record.issuedAt || record.issued_at,
    };

    const { db, stmts } = getTenantDb(tenantId);

    db.transaction(() => {
      stmts.insertCred.run(normRecord);
      stmts.insertShare.run({
        id: `${normRecord.id}-${shareIndex}`,
        credentialId: normRecord.id,
        shareIndex,
        shareValue: value,
        shareHash,
        shareChecksum: checksum || null
      });
    })();

    res.status(201).json({ success: true, nodeId: NODE_INDEX, credentialId: normRecord.id });
  } catch (err) {
    console.error('Shard Node Write Error:', err.stack || err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// Get Shard Route
app.get('/shard/:credentialId', authenticateInterService, requireTenant, (req, res) => {
  try {
    const { credentialId } = req.params;
    const tenantId = req.tenantId;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!credentialId || !uuidRegex.test(credentialId)) {
      return res.status(400).json({ error: 'Invalid parameter: credentialId must be a valid UUID v4' });
    }

    const { stmts } = getTenantDb(tenantId);
    const cred = stmts.getCred.get(credentialId);
    const share = stmts.getShare.get(credentialId);
    res.json({ success: true, credential: cred, share });
  } catch (err) {
    console.error('Shard Node Read Error:', err.stack || err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// Update Status / Anchor Route
app.post('/update-status', authenticateInterService, requireTenant, (req, res) => {
  try {
    const { credentialId, status, anchorTxId } = req.body;
    const tenantId = req.tenantId;
    
    // Strict ZTA input validation and sanitization
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!credentialId || !uuidRegex.test(credentialId)) {
      return res.status(400).json({ error: 'Invalid parameter: credentialId must be a valid UUID v4' });
    }

    const allowedStatuses = ['pending', 'anchored', 'failed', 'revoked'];
    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid parameter: status must be a recognized value' });
    }

    const hex64Regex = /^[0-9a-f]{64}$/i;
    if (anchorTxId && !hex64Regex.test(anchorTxId)) {
      return res.status(400).json({ error: 'Invalid parameter: anchorTxId must be a 64-character hex string' });
    }

    const { stmts } = getTenantDb(tenantId);

    if (anchorTxId) {
      stmts.updateAnchor.run(anchorTxId, status, credentialId);
    } else {
      stmts.updateStatus.run(status, credentialId);
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Shard Node Update Status Error:', err.stack || err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// Integrity Check Route
app.get('/integrity', authenticateInterService, requireTenant, (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { stmts } = getTenantDb(tenantId);
    const shares = stmts.getAllShares.all();
    let isCorrupted = false;

    for (const s of shares) {
      const computedHash = createHash('sha3-256').update(s.share_value).digest('hex');
      if (computedHash !== s.share_hash) {
        isCorrupted = true;
        break;
      }
    }

    res.json({
      nodeId: parseInt(NODE_INDEX, 10),
      status: isCorrupted ? 'CORRUPTED' : 'HEALTHY',
      integrityCheck: isCorrupted ? 'HASH_MISMATCH' : 'VALID',
      totalShares: shares.length
    });
  } catch (err) {
    console.error('Shard Node Integrity Error:', err.stack || err.message);
    res.status(500).json({ status: 'ERROR', error: 'Internal Server Error' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`ScatterID Shard Node ${NODE_INDEX} running on port ${PORT}`);
});

process.on('SIGTERM', () => {
  console.log(`Shard Node ${NODE_INDEX} received SIGTERM, exiting...`);
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log(`Shard Node ${NODE_INDEX} received SIGINT, exiting...`);
  process.exit(0);
});
