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
