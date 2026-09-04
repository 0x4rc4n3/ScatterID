process.env.NODE_ENV = 'test';
process.env.SQLITE_DB_PATH = ':memory:';
process.env.VERIFICATION_API_KEY = 'test-key';
process.env.REVOKE_API_KEY = 'test-revoke-key';
process.env.CRYPTO_SERVICE_API_KEY = 'test-crypto-key';

import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { issueRoute } from '../src/routes/issue.js';
import { statusRoute } from '../src/routes/status.js';
import { verifyRoute } from '../src/routes/verify.js';
import { createCredential, getCredentialById, getCredentialByIdempotencyKey, getAllCredentials, updateStatus, updateAnchorInfo } from '../src/db/models.js';

test('createCredential and getCredentialById test', async () => {
  const testId = randomUUID();
  const record = {
    id: testId,
    dataHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    algorithm: 'ML-DSA-65',
    signature: '1234567890abcdef',
    publicKeyId: 'valid-key-id',
    anchorTxId: 'tx-12345',
    status: 'anchored',
    issuedAt: new Date().toISOString(),
    idempotencyKey: `idemp-key-${Date.now()}`
  };

  await createCredential(record);

  const fetched = await getCredentialById(testId);
  assert.ok(fetched, 'Credential should be retrieved by ID');
  assert.equal(fetched.id, testId);
  assert.equal(fetched.algorithm, 'ML-DSA-65');
});

test('statusRoute returns awaited record with proper field normalization', async () => {
  const testId = randomUUID();
  const record = {
    id: testId,
    dataHash: 'hash12345',
    algorithm: 'ML-DSA-65',
    signature: 'sig12345',
    publicKeyId: 'valid-key-id',
    anchorTxId: 'tx-status-999',
    status: 'anchored',
    issuedAt: new Date().toISOString(),
    idempotencyKey: `idemp-key-${Date.now()}-status`
  };

  await createCredential(record);

  let responseData = null;
  let responseStatus = null;
  const mockReq = { params: { id: testId } };
  const mockRes = {
    status(s) {
      responseStatus = s;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    }
  };

  await statusRoute(mockReq, mockRes);
  assert.equal(responseStatus, 200);
  assert.equal(responseData.id, testId);
  assert.equal(responseData.dataHash, 'hash12345');
  assert.equal(responseData.anchorTxId, 'tx-status-999');
  assert.equal(responseData.status, 'anchored');
});

test('issueRoute deduplicates identical idempotency keys', async () => {
  const dataHash = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
  const idKey = `idemp-issue-${Date.now()}`;
  
  // Mock global fetch for crypto-service
  const originalFetch = global.fetch;
  global.fetch = async (url, options) => {
    return {
      ok: true,
      json: async () => ({
        credentialId: randomUUID(),
        dataHash: dataHash,
        signature: 'sig123',
        publicKeyId: 'valid-key-id',
        algorithm: 'ML-DSA-65',
        issuedAt: new Date().toISOString()
      })
    };
  };

  try {
    const mockRes1 = {
      statusCode: null,
      responseJson: null,
      status(s) { this.statusCode = s; return this; },
      json(data) { this.responseJson = data; return this; }
    };
    
    const mockReq1 = { body: { dataHash, idempotencyKey: idKey } };
    await issueRoute(mockReq1, mockRes1);
    
    assert.ok(mockRes1.statusCode === 201 || mockRes1.statusCode === 202, 'First call should return 201 Created or 202 Accepted');
    assert.ok(mockRes1.responseJson.credentialId, 'First call should return a credential ID');
    const firstId = mockRes1.responseJson.credentialId;

    const mockRes2 = {
      statusCode: null,
      responseJson: null,
      status(s) { this.statusCode = s; return this; },
      json(data) { this.responseJson = data; return this; }
    };
    
    const mockReq2 = { body: { dataHash, idempotencyKey: idKey } };
    await issueRoute(mockReq2, mockRes2);
    
    assert.equal(mockRes2.statusCode, 200, 'Second call should return 200 OK (idempotent result)');
    const secondId = mockRes2.responseJson.credentialId;
    
    assert.equal(firstId, secondId, 'Both calls should return the same credential ID');
    
    const credentials = await getAllCredentials();
    const count = credentials.filter(c => (c.idempotencyKey || c.idempotency_key) === idKey).length;
    assert.equal(count, 1, 'Only one row should be created in the database for the given idempotency key');
  } finally {
    global.fetch = originalFetch;
  }
});

test('verifyRoute uses only registry-resolved publicKeyId and ignores attacker manipulation', async () => {
  const testId = randomUUID();
  const dataHash = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
  
  const record = {
    id: testId,
    dataHash: dataHash,
    algorithm: 'ML-DSA-65',
    signature: 'sig123',
    publicKeyId: 'legit-registry-id',
    anchorTxId: 'tx-verify-999',
    status: 'anchored',
    issuedAt: new Date().toISOString()
  };

  await createCredential(record);
  
  const originalFetch = global.fetch;
  let cryptoPayload = null;
  
  global.fetch = async (url, options) => {
    if (url.includes('verify_hash') || url.includes('5001')) {
        cryptoPayload = JSON.parse(options.body);
        return {
          ok: true,
          json: async () => ({
            valid: cryptoPayload.publicKeyId === 'legit-registry-id'
          })
        };
    }
    return { ok: true, json: async () => ({}) }; // fallback
  };

  try {
    const mockReq = { 
        body: { 
            dataHash, 
            credentialId: testId,
            publicKeyId: 'attacker-id',
            publicKey: 'attacker-pub-key'
        } 
    };
    
    let responseData = null;
    let responseStatus = null;
    const mockRes = {
      status(s) { responseStatus = s; return this; },
      json(data) { responseData = data; return this; }
    };

    await verifyRoute(mockReq, mockRes);
    
    // The crypto-service SHOULD receive the registry publicKeyId, not the attacker's
    assert.ok(cryptoPayload, 'Crypto service should have been called');
    assert.equal(cryptoPayload.publicKeyId, 'legit-registry-id', 'verifyRoute should pass the registry publicKeyId to crypto-service, ignoring attacker request fields');
    
    // SECURITY: Without a live Fabric ledger, the credential MUST resolve to invalid.
    // The fail-closed rule requires BOTH a valid signature AND an active on-chain anchor.
    // In test environments, Fabric is not available, so isAnchoredOnChain=false → isValid=false.
    // Test environments should mock the Fabric client, not bypass validation logic.
    assert.equal(responseData.valid, false, 'Verification must fail-closed when Fabric ledger is unreachable');
  } finally {
    global.fetch = originalFetch;
  }
});

test('verifyRoute rejects tampered dataHash not matching stored record', async () => {
  const testId = randomUUID();
  const realHash = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

  await createCredential({
    id: testId,
    dataHash: realHash,
    algorithm: 'ML-DSA-65',
    signature: 'sig123',
    publicKeyId: 'key-id',
    anchorTxId: 'tx-123',
    status: 'anchored',
    issuedAt: new Date().toISOString()
  });

  const tamperedHash = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: true, json: async () => ({ valid: true }) });

  try {
    let responseData = null;
    const mockRes = {
      status(s) { return this; },
      json(data) { responseData = data; return this; }
    };
    await verifyRoute({ body: { dataHash: tamperedHash, credentialId: testId } }, mockRes);
    assert.equal(responseData.valid, false, 'Tampered hash should be rejected');
    assert.equal(responseData.anchorStatus, 'tampered_hash');
  } finally {
    global.fetch = originalFetch;
  }
});

test('verifyRoute returns 502 when crypto-service is unreachable', async () => {
  const testId = randomUUID();
  const dataHash = 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc';

  await createCredential({
    id: testId,
    dataHash,
    algorithm: 'ML-DSA-65',
    signature: 'sig123',
    publicKeyId: 'key-id',
    anchorTxId: null,
    status: 'pending',
    issuedAt: new Date().toISOString()
  });

  const originalFetch = global.fetch;
  global.fetch = async () => { throw new Error('Connection refused'); };

  try {
    let responseStatus = null;
    let responseData = null;
    const mockRes = {
      status(s) { responseStatus = s; return this; },
      json(data) { responseData = data; return this; }
    };
    await verifyRoute({ body: { dataHash, credentialId: testId } }, mockRes);
    assert.equal(responseStatus, 502, 'Should return 502 when crypto-service is unreachable');
    assert.equal(responseData.code, 'CRYPTO_SERVICE_UNREACHABLE');
  } finally {
    global.fetch = originalFetch;
  }
});

test('issueRoute returns 502 when crypto-service is unreachable', async () => {
  const dataHash = 'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd';

  const originalFetch = global.fetch;
  global.fetch = async () => { throw new Error('Connection refused'); };

  try {
    let responseStatus = null;
    let responseData = null;
    const mockRes = {
      status(s) { responseStatus = s; return this; },
      json(data) { responseData = data; return this; }
    };
    await issueRoute({ body: { dataHash } }, mockRes);
    assert.equal(responseStatus, 502, 'Should return 502 when crypto-service is unreachable');
    assert.equal(responseData.code, 'CRYPTO_SERVICE_UNREACHABLE');
  } finally {
    global.fetch = originalFetch;
  }
});

test('toApiShape normalizes snake_case DB row to camelCase API shape', async () => {
  const { toApiShape } = await import('../src/db/models.js');
  const row = {
    id: 'test-id',
    data_hash: 'hash123',
    algorithm: 'ML-DSA-65',
    signature: 'sig',
    public_key_id: 'pkid',
    anchor_tx_id: 'tx1',
    status: 'anchored',
    issued_at: '2026-01-01T00:00:00Z',
    idempotency_key: 'ik1'
  };
  const mapped = toApiShape(row);
  assert.equal(mapped.dataHash, 'hash123', 'data_hash should map to dataHash');
  assert.equal(mapped.publicKeyId, 'pkid', 'public_key_id should map to publicKeyId');
  assert.equal(mapped.anchorTxId, 'tx1', 'anchor_tx_id should map to anchorTxId');
  assert.equal(mapped.issuedAt, '2026-01-01T00:00:00Z', 'issued_at should map to issuedAt');
  assert.equal(mapped.idempotencyKey, 'ik1', 'idempotency_key should map to idempotencyKey');
  assert.equal(mapped.data_hash, undefined, 'snake_case data_hash should not be present in output');
});

test('issueRoute returns 202 and sets DB to anchor_failed when anchorProof throws', async () => {
  const { retryAnchorRoute } = await import('../src/routes/issue.js');
  const dataHash = '1111111122222222333333334444444455555555666666667777777788888888';
  const originalFetch = global.fetch;

  // Mock crypto-service response
  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      credentialId: randomUUID(),
      dataHash,
      signature: 'sig-test',
      publicKeyId: 'key-test',
      algorithm: 'ML-DSA-65',
      issuedAt: new Date().toISOString()
    })
  });

  try {
    let responseStatus = null;
    let responseData = null;
    const mockRes = {
      status(s) { responseStatus = s; return this; },
      json(data) { responseData = data; return this; }
    };

    await issueRoute({ body: { dataHash } }, mockRes);

    // Assert HTTP status is 202 Accepted, NOT 201 or silent 200
    assert.equal(responseStatus, 202, 'Should return 202 Accepted on anchor failure');
    assert.equal(responseData.status, 'anchor_failed', 'Response status must indicate anchor_failed');
    assert.ok(responseData.reason, 'Response must include error reason');

    // Assert DB status matches HTTP status
    const dbRecord = await getCredentialById(responseData.credentialId);
    assert.ok(dbRecord, 'Record must exist in DB');
    assert.equal(dbRecord.status, 'anchor_failed', 'Database status must match anchor_failed');
  } finally {
    global.fetch = originalFetch;
  }
});

test('revokeRoute returns 502 and does NOT alter local DB status when revokeProof throws', async () => {
  const { revokeRoute } = await import('../src/routes/revoke.js');
  const testId = randomUUID();

  // Create an active credential in DB
  await createCredential({
    id: testId,
    dataHash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    algorithm: 'ML-DSA-65',
    signature: 'sig-valid',
    publicKeyId: 'key-1',
    anchorTxId: 'tx-initial',
    status: 'anchored',
    issuedAt: new Date().toISOString()
  });

  let responseStatus = null;
  let responseData = null;
  const mockRes = {
    status(s) { responseStatus = s; return this; },
    json(data) { responseData = data; return this; }
  };

  await revokeRoute({ body: { credentialId: testId } }, mockRes);

  // In test environment without Fabric running, revokeProof throws
  assert.equal(responseStatus, 502, 'Should return 502 Bad Gateway when Fabric ledger call fails');
  assert.equal(responseData.code, 'LEDGER_UNREACHABLE', 'Error code should be LEDGER_UNREACHABLE');

  // Verify that local database status remains 'anchored', NOT prematurely set to 'revoked'
  const recordAfter = await getCredentialById(testId);
  assert.equal(recordAfter.status, 'anchored', 'Database status must remain unchanged on Fabric failure');
});

test('audit log records events and provides query interface', async () => {
  const { recordAuditLog, getAuditLogs } = await import('../src/db/models.js');
  const testId = randomUUID();

  recordAuditLog({
    credentialId: testId,
    action: 'test_action',
    status: 'success',
    details: { test: true },
    callerTier: 'bearer_api_key'
  });

  const logs = getAuditLogs(10);
  assert.ok(Array.isArray(logs), 'Audit logs should be an array');
  const found = logs.find(l => l.credentialId === testId);
  assert.ok(found, 'Should find the recorded audit event');
  assert.equal(found.action, 'test_action');
  assert.equal(found.status, 'success');
});

