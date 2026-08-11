import Database from 'better-sqlite3';
import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import { getConfig } from '../config.js';

const NUM_NODES = getConfig('cryptography.total_shards_n', 5);

const DB_DIR = process.env.DB_DIR || (fs.existsSync('/app/data') ? '/app/data' : path.resolve(process.cwd(), 'data'));
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

// Lazy Local SQLite Database Pool per Tenant
const tenantLocalNodes = new Map();

function getTenantLocalNodes(tenantId = 'default-tenant') {
  if (tenantLocalNodes.has(tenantId)) {
    return tenantLocalNodes.get(tenantId);
  }

  const nodesList = [];
  for (let i = 1; i <= NUM_NODES; i++) {
    const nodeDbPath = path.join(DB_DIR, `${tenantId}_node_${i}.db`);
    const nodeDb = new Database(nodeDbPath);
    nodeDb.exec(`
      CREATE TABLE IF NOT EXISTS credentials (
        id TEXT PRIMARY KEY,
        data_hash TEXT NOT NULL,
        algorithm TEXT NOT NULL,
        signature TEXT NOT NULL,
        publicKey TEXT,
        prime_mod TEXT NOT NULL,
        required_shares INTEGER NOT NULL,
        anchor_tx_id TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        issued_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS shard_references (
        id TEXT PRIMARY KEY,
        credential_id TEXT NOT NULL REFERENCES credentials(id),
        share_index INTEGER NOT NULL,
        share_value TEXT NOT NULL,
        share_hash TEXT NOT NULL,
        share_checksum TEXT,
        UNIQUE(credential_id, share_index)
      );

      CREATE INDEX IF NOT EXISTS idx_shard_refs_credential ON shard_references(credential_id);
    `);

    try {
      nodeDb.exec("ALTER TABLE credentials ADD COLUMN publicKey TEXT;");
    } catch (e) {}

    const stmts = {
      insertCred: nodeDb.prepare(`
        INSERT OR IGNORE INTO credentials (id, data_hash, algorithm, signature, publicKey, prime_mod, required_shares, anchor_tx_id, status, issued_at)
        VALUES (@id, @dataHash, @algorithm, @signature, @publicKey, @primeMod, @requiredShares, @anchorTxId, @status, @issuedAt)
      `),
      insertShare: nodeDb.prepare(`
        INSERT OR REPLACE INTO shard_references (id, credential_id, share_index, share_value, share_hash, share_checksum)
        VALUES (@id, @credentialId, @shareIndex, @shareValue, @shareHash, @shareChecksum)
      `),
      getCred: nodeDb.prepare('SELECT * FROM credentials WHERE id = ?'),
      getShare: nodeDb.prepare('SELECT * FROM shard_references WHERE credential_id = ?'),
      getShares: nodeDb.prepare('SELECT * FROM shard_references WHERE credential_id = ?'),
      updateStatus: nodeDb.prepare('UPDATE credentials SET status = ? WHERE id = ?'),
      updateAnchor: nodeDb.prepare('UPDATE credentials SET anchor_tx_id = ?, status = ? WHERE id = ?'),
    };

    nodesList.push({ db: nodeDb, stmts, nodeId: i });
  }

  tenantLocalNodes.set(tenantId, nodesList);
  return nodesList;
}

const SHARD_NODE_API_KEY = getConfig('security.shard_node_api_key', process.env.SHARD_NODE_API_KEY);
if (!SHARD_NODE_API_KEY) {
  throw new Error("CRITICAL: SHARD_NODE_API_KEY is not configured. For security, the verification gateway cannot start without it.");
}

function getAuthHeaders(tenantId, extraHeaders = {}) {
  const headers = { 
    'Content-Type': 'application/json',
    'X-Tenant-ID': tenantId || 'default-tenant',
    ...extraHeaders 
  };
  if (SHARD_NODE_API_KEY) {
    headers['Authorization'] = `Bearer ${SHARD_NODE_API_KEY}`;
  }
  return headers;
}

// Helper to get shard node URL
function getShardNodeUrl(nodeId) {
  if (process.env.SHARD_NODE_HOST_PREFIX) {
    return `${process.env.SHARD_NODE_HOST_PREFIX}${nodeId}:3000`;
  }
  return `http://shard-node-${nodeId}:3000`;
}

export async function createCredential(record, shares, tenantId = 'default-tenant') {
  const normRecord = {
    id: record.id,
    dataHash: record.dataHash || record.data_hash,
    algorithm: record.algorithm,
    signature: record.signature,
    publicKey: record.publicKey || record.public_key || null,
    primeMod: record.primeMod || record.prime_mod,
    requiredShares: record.requiredShares || record.required_shares,
    anchorTxId: record.anchorTxId || record.anchor_tx_id || null,
    status: record.status || 'pending',
    issuedAt: record.issuedAt || record.issued_at,
  };

  const dispatchReport = [];
  const tenantNodes = getTenantLocalNodes(tenantId);

  for (const share of shares) {
    const [core, checksum] = share.split(':');
    const [indexStr, value] = core.split('-');
    const shareIndex = parseInt(indexStr, 10);
    const nodeIndex = shareIndex - 1;

    if (nodeIndex >= 0 && nodeIndex < NUM_NODES) {
      const nodeUrl = getShardNodeUrl(shareIndex);
      let httpSuccess = false;
      try {
        const res = await fetch(`${nodeUrl}/shard`, {
          method: 'POST',
          headers: getAuthHeaders(tenantId),
          body: JSON.stringify({ record: normRecord, share }),
          signal: AbortSignal.timeout(2000)
        });
        httpSuccess = res.ok;
      } catch (err) {
        console.warn(`Failed to dispatch share ${shareIndex} to ${nodeUrl}:`, err.message);
      }

      const shareHash = createHash('sha3-256').update(value).digest('hex');
      let localSuccess = false;

      // Replicate credential record across ALL local node DBs for this tenant,
      // and store the specific share in nodeIndex's local DB.
      for (let n = 0; n < NUM_NODES; n++) {
        const { db, stmts } = tenantNodes[n];
        try {
          db.transaction(() => {
            stmts.insertCred.run(normRecord);
            if (n === nodeIndex) {
              stmts.insertShare.run({
                id: `${normRecord.id}-${shareIndex}`,
                credentialId: normRecord.id,
                shareIndex,
                shareValue: value,
                shareHash,
                shareChecksum: checksum || null,
              });
            }
          })();
          if (n === nodeIndex) localSuccess = true;
        } catch (err) {
          console.warn(`Local SQLite write error on node ${n + 1} for tenant ${tenantId}:`, err.message);
        }
      }

      dispatchReport.push({
        nodeId: shareIndex,
        shareIndex,
        containerUrl: nodeUrl,
        httpStatus: httpSuccess ? 'WRITTEN' : 'OFFLINE_FAILED',
        localDbStatus: localSuccess ? 'WRITTEN' : 'FAILED',
        shareHash: shareHash.substring(0, 16) + '...'
      });
    }
  }

  return dispatchReport;
}

export async function getCredentialById(id, tenantId = 'default-tenant') {
  // 1. Try HTTP endpoints of all shard nodes
  for (let i = 1; i <= NUM_NODES; i++) {
    try {
      const response = await fetch(`${getShardNodeUrl(i)}/shard/${id}`, {
        headers: getAuthHeaders(tenantId),
        signal: AbortSignal.timeout(1500)
      });
      if (response.ok) {
        const data = await response.json();
        if (data.credential) return data.credential;
      }
    } catch (err) {}
  }

  // 2. Fallback to checking ALL local DB nodes in order
  const tenantNodes = getTenantLocalNodes(tenantId);
  for (let i = 0; i < NUM_NODES; i++) {
    try {
      const cred = tenantNodes[i].stmts.getCred.get(id);
      if (cred) return cred;
    } catch (err) {}
  }

  return null;
}

export async function getSharesByCredentialId(id, tenantId = 'default-tenant') {
  const allShares = [];

  for (let i = 1; i <= NUM_NODES; i++) {
    let share = null;

    // Strict HTTP container network call (no local disk bypass)
    try {
      const response = await fetch(`${getShardNodeUrl(i)}/shard/${id}`, {
        headers: getAuthHeaders(tenantId),
        signal: AbortSignal.timeout(1200)
      });
      if (response.ok) {
        const data = await response.json();
        if (data.share) {
          share = data.share;
        }
      }
    } catch (err) {}

    if (share) {
      allShares.push(share);
    } else {
      console.warn(`Shard Node ${i} HTTP container unavailable or has no share for credential ${id}`);
    }
  }

  return allShares.sort((a, b) => a.share_index - b.share_index);
}

export async function updateStatus(id, status, tenantId = 'default-tenant') {
  const tenantNodes = getTenantLocalNodes(tenantId);
  for (let i = 1; i <= NUM_NODES; i++) {
    try {
      await fetch(`${getShardNodeUrl(i)}/update-status`, {
        method: 'POST',
        headers: getAuthHeaders(tenantId),
        body: JSON.stringify({ credentialId: id, status })
      });
    } catch (err) {}
    try {
      tenantNodes[i - 1].stmts.updateStatus.run(status, id);
    } catch (err) {}
  }
}

export async function updateAnchorInfo(id, anchorTxId, status, tenantId = 'default-tenant') {
  const tenantNodes = getTenantLocalNodes(tenantId);
  for (let i = 1; i <= NUM_NODES; i++) {
    try {
      await fetch(`${getShardNodeUrl(i)}/update-status`, {
        method: 'POST',
        headers: getAuthHeaders(tenantId),
        body: JSON.stringify({ credentialId: id, anchorTxId, status })
      });
    } catch (err) {}
    try {
      tenantNodes[i - 1].stmts.updateAnchor.run(anchorTxId, status, id);
    } catch (err) {}
  }
}

export async function healShards(nodeId = null, tenantId = 'default-tenant') {
  const syncedEvents = [];
  const targetNodes = nodeId ? [parseInt(nodeId, 10)] : [1, 2, 3, 4, 5];
  const tenantNodes = getTenantLocalNodes(tenantId);

  for (const nId of targetNodes) {
    const nodeUrl = getShardNodeUrl(nId);

    try {
      const hRes = await fetch(`${nodeUrl}/health`, { signal: AbortSignal.timeout(1200) });
      if (!hRes.ok) continue;
    } catch (e) {
      continue;
    }

    // Find local shares for nId across all local nodes for this tenant
    let localShares = [];
    for (let i = 0; i < NUM_NODES; i++) {
      try {
        const rows = tenantNodes[i].db.prepare(`
          SELECT s.*, c.data_hash, c.algorithm, c.signature, c.prime_mod, c.required_shares, c.anchor_tx_id, c.status, c.issued_at 
          FROM shard_references s 
          JOIN credentials c ON s.credential_id = c.id 
          WHERE s.share_index = ?
        `).all(nId);
        if (rows && rows.length > 0) {
          localShares = rows;
          break;
        }
      } catch (e) {}
    }

    let healedCount = 0;
    for (const row of localShares) {
      try {
        const checkRes = await fetch(`${nodeUrl}/shard/${row.credential_id}`, {
          headers: getAuthHeaders(tenantId),
          signal: AbortSignal.timeout(1000)
        });
        if (checkRes.ok) {
          const checkData = await checkRes.json();
          if (!checkData.share) {
            const record = {
              id: row.credential_id,
              dataHash: row.data_hash,
              algorithm: row.algorithm,
              signature: row.signature,
              primeMod: row.prime_mod,
              requiredShares: row.required_shares,
              anchorTxId: row.anchor_tx_id,
              status: row.status,
              issuedAt: row.issued_at
            };
            const share = `${row.share_index}-${row.share_value}:${row.share_checksum || ''}`;

            const syncRes = await fetch(`${nodeUrl}/shard`, {
              method: 'POST',
              headers: getAuthHeaders(tenantId),
              body: JSON.stringify({ record, share })
            });
            if (syncRes.ok) healedCount++;
          }
        }
      } catch (e) {}
    }

    syncedEvents.push({
      nodeId: nId,
      healedShares: healedCount,
      timestamp: new Date().toISOString(),
      logText: `[AUTO-HEAL] Shard Node ${nId} auto-synced ${healedCount} missing secret shares for tenant ${tenantId}.`
    });
  }

  return syncedEvents;
}

export async function getAllCredentials(tenantId = 'default-tenant') {
  const credMap = new Map();
  const tenantNodes = getTenantLocalNodes(tenantId);

  for (let i = 0; i < NUM_NODES; i++) {
    try {
      const rows = tenantNodes[i].db.prepare('SELECT * FROM credentials ORDER BY issued_at DESC').all();
      for (const row of rows) {
        if (!credMap.has(row.id)) {
          credMap.set(row.id, row);
        }
      }
    } catch (e) {}
  }

  const credentialsWithShards = [];
  for (const cred of credMap.values()) {
    const allShards = await getSharesByCredentialId(cred.id, tenantId);
    credentialsWithShards.push({
      ...cred,
      shards: allShards
    });
  }

  return credentialsWithShards;
}
