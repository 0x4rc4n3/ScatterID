process.env.NODE_ENV = 'test';
process.env.SQLITE_DB_PATH = ':memory:';
process.env.VERIFICATION_API_KEY = 'test-auth-key-boundary';
process.env.REVOKE_API_KEY = 'test-revoke-key-boundary';
process.env.CRYPTO_SERVICE_API_KEY = 'test-crypto-key-boundary';

import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const { app } = await import('../src/server.js');
const { createCredential, getAuditLogs, recordAuditLog, clearDatabase } = await import('../src/db/models.js');

let server;
let baseUrl;

function startServer() {
  return new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
}

function stopServer() {
  return new Promise((resolve) => server.close(resolve));
}

test('Boundary & Edge-Case: /audit ?limit= parameter clamping and injection resistance (§3)', async (t) => {
  await startServer();
  clearDatabase();

  // Populate 120 audit log entries to test limit clamping
  for (let i = 0; i < 120; i++) {
    recordAuditLog({
      credentialId: randomUUID(),
      action: `test_action_${i}`,
      status: 'success',
      details: { index: i },
      callerTier: 'bearer_api_key'
    });
  }

  const authHeaders = {
    'Authorization': 'Bearer test-auth-key-boundary',
    'Content-Type': 'application/json'
  };

  try {
    // 1. Negative numbers: must clamp to 50, NEVER bypass limit or return all 120 rows
    const resNeg = await fetch(`${baseUrl}/audit?limit=-999999999`, { headers: authHeaders });
    assert.equal(resNeg.status, 200);
    const bodyNeg = await resNeg.json();
    assert.equal(bodyNeg.count, 50, 'Negative limit must clamp safely to 50');

    const resNegOne = await fetch(`${baseUrl}/audit?limit=-1`, { headers: authHeaders });
    assert.equal(resNegOne.status, 200);
    const bodyNegOne = await resNegOne.json();
    assert.equal(bodyNegOne.count, 50, 'limit=-1 must clamp safely to 50');

    // 2. Zero limit: must clamp safely to 50
    const resZero = await fetch(`${baseUrl}/audit?limit=0`, { headers: authHeaders });
    assert.equal(resZero.status, 200);
    const bodyZero = await resZero.json();
    assert.equal(bodyZero.count, 50, 'limit=0 must clamp safely to 50');

    // 3. NaN limit: must clamp safely to 50
    const resNaN = await fetch(`${baseUrl}/audit?limit=NaN`, { headers: authHeaders });
    assert.equal(resNaN.status, 200);
    const bodyNaN = await resNaN.json();
    assert.equal(bodyNaN.count, 50, 'limit=NaN must clamp safely to 50');

    // 4. Infinity limit: must clamp safely to 50
    const resInf = await fetch(`${baseUrl}/audit?limit=Infinity`, { headers: authHeaders });
    assert.equal(resInf.status, 200);
    const bodyInf = await resInf.json();
    assert.equal(bodyInf.count, 50, 'limit=Infinity must clamp safely to 50');

    // 5. Huge number: must clamp strictly to maximum of 200 (or available rows)
    const resHuge = await fetch(`${baseUrl}/audit?limit=999999999`, { headers: authHeaders });
    assert.equal(resHuge.status, 200);
    const bodyHuge = await resHuge.json();
    assert.equal(bodyHuge.count, 120, 'limit=999999999 must clamp to max available <= 200');

    // 6. Valid custom limit within [1, 200]: must return exactly requested count
    const resTen = await fetch(`${baseUrl}/audit?limit=10`, { headers: authHeaders });
    assert.equal(resTen.status, 200);
    const bodyTen = await resTen.json();
    assert.equal(bodyTen.count, 10, 'limit=10 must return exactly 10 rows');

    // 7. SQL injection string: must not break query or bypass limit
    const resSql = await fetch(`${baseUrl}/audit?limit=10;+DROP+TABLE+audit_log;`, { headers: authHeaders });
    assert.equal(resSql.status, 200);
    const bodySql = await resSql.json();
    assert.equal(bodySql.count, 10, 'SQL injection in limit must parse safely');
  } finally {
    await stopServer();
  }
});

test('Boundary & Edge-Case: models.js getAuditLogs direct clamping boundary tests', () => {
  // Test direct function interface defense-in-depth
  assert.equal(getAuditLogs(-999999).length <= 50, true);
  assert.equal(getAuditLogs(-1).length <= 50, true);
  assert.equal(getAuditLogs(0).length <= 50, true);
  assert.equal(getAuditLogs(NaN).length <= 50, true);
  assert.equal(getAuditLogs(Infinity).length <= 50, true);
  assert.equal(getAuditLogs(10).length <= 10, true);
});

test('Boundary & Edge-Case: /verify parameter boundaries (hashes, UUIDs, off-by-one signatures)', async () => {
  await startServer();
  clearDatabase();

  const validId = randomUUID();
  const validHash = '1111222233334444555566667777888811112222333344445555666677778888';

  await createCredential({
    id: validId,
    dataHash: validHash,
    algorithm: 'ML-DSA-65',
    signature: 'aa'.repeat(3309), // 3309 bytes
    publicKeyId: 'bb'.repeat(16),     // 32 hex chars
    anchorTxId: 'tx-1',
    status: 'anchored',
    issuedAt: new Date().toISOString()
  });

  try {
    // 1. dataHash boundary: 63 characters (off-by-one under)
    const resShortHash = await fetch(`${baseUrl}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credentialId: validId, dataHash: 'a'.repeat(63) })
    });
    assert.equal(resShortHash.status, 400);
    assert.equal((await resShortHash.json()).code, 'INVALID_PARAMETER');

    // 2. dataHash boundary: 65 characters (off-by-one over)
    const resLongHash = await fetch(`${baseUrl}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credentialId: validId, dataHash: 'a'.repeat(65) })
    });
    assert.equal(resLongHash.status, 400);
    assert.equal((await resLongHash.json()).code, 'INVALID_PARAMETER');

    // 3. dataHash non-hex characters
    const resNonHex = await fetch(`${baseUrl}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credentialId: validId, dataHash: 'g'.repeat(64) })
    });
    assert.equal(resNonHex.status, 400);
    assert.equal((await resNonHex.json()).code, 'INVALID_PARAMETER');

    // 4. credentialId malformed UUID: extra character
    const resBadUuid = await fetch(`${baseUrl}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credentialId: `${validId}a`, dataHash: validHash })
    });
    assert.equal(resBadUuid.status, 400);
    assert.equal((await resBadUuid.json()).code, 'INVALID_PARAMETER');

    // 5. credentialId empty string
    const resEmptyUuid = await fetch(`${baseUrl}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credentialId: '', dataHash: validHash })
    });
    assert.equal(resEmptyUuid.status, 400);
    assert.equal((await resEmptyUuid.json()).code, 'INVALID_PARAMETER');
  } finally {
    await stopServer();
  }
});
