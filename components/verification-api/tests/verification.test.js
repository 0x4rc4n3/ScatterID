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
    
    assert.equal(mockRes1.statusCode, 201, 'First call should return 201 Created');
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
    const count = credentials.filter(c => c.idempotency_key === idKey).length;
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
    const mockRes = {
      status(s) { return this; },
      json(data) { responseData = data; return this; }
    };

    await verifyRoute(mockReq, mockRes);
    
    assert.ok(cryptoPayload, 'Crypto service should have been called');
    assert.equal(cryptoPayload.publicKeyId, 'legit-registry-id', 'verifyRoute should pass the registry publicKeyId to crypto-service, ignoring attacker request fields');
    assert.equal(responseData.valid, true, 'Verification should succeed against the legit key');
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
