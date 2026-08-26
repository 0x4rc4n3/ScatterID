import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { issueRoute } from '../src/routes/issue.js';
import { statusRoute } from '../src/routes/status.js';
import { verifyRoute } from '../src/routes/verify.js';
import { createCredential, getCredentialById, getSharesByCredentialId } from '../src/db/models.js';

test('createCredential and getCredentialById multi-node fallback test', async () => {
  const testId = `test-cred-${Date.now()}`;
  const record = {
    id: testId,
    dataHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    algorithm: 'ML-DSA-65',
    signature: '1234567890abcdef',
    primeMod: '65537',
    requiredShares: 3,
    anchorTxId: 'tx-12345',
    status: 'anchored',
    issuedAt: new Date().toISOString(),
  };

  const shares = [
    '1-111111:chk1',
    '2-222222:chk2',
    '3-333333:chk3',
    '4-444444:chk4',
    '5-555555:chk5',
  ];

  await createCredential(record, shares);

  // Verify getCredentialById returns the record via local node DB fallbacks
  const fetched = await getCredentialById(testId);
  assert.ok(fetched, 'Credential should be retrieved by ID');
  assert.equal(fetched.id, testId);
  assert.equal(fetched.algorithm, 'ML-DSA-65');

  // Verify getSharesByCredentialId falls back to local DB nodes
  const fetchedShares = await getSharesByCredentialId(testId);
  assert.ok(fetchedShares.length >= 3, 'Should retrieve at least 3 valid secret shares');
  assert.equal(fetchedShares[0].share_index, 1);
  assert.equal(fetchedShares[0].share_value, '111111');
});

test('statusRoute returns awaited record with proper field normalization', async () => {
  const testId = `test-cred-status-${Date.now()}`;
  const record = {
    id: testId,
    dataHash: 'hash12345',
    algorithm: 'ML-DSA-65',
    signature: 'sig12345',
    primeMod: '65537',
    requiredShares: 3,
    anchorTxId: 'tx-status-999',
    status: 'anchored',
    issuedAt: new Date().toISOString(),
  };

  const shares = ['1-aaaaaa:chk', '2-bbbbbb:chk', '3-cccccc:chk'];
  await createCredential(record, shares);

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

test('verifyRoute rejects tampered share with forged SHA-256 MAC', async () => {
  const testId = `test-cred-tampered-${Date.now()}`;
  const record = {
    id: testId,
    dataHash: 'hash123',
    algorithm: 'ML-DSA-65',
    signature: 'sig123',
    primeMod: '65537',
    requiredShares: 3,
    status: 'anchored',
    issuedAt: new Date().toISOString(),
  };

  // Create shares where one share has a re-computed SHA256 MAC that will fail the HMAC check
  const crypto = await import('crypto');
  const validCoreShare1 = '1-aaaaaa';
  const validCoreShare2 = '2-bbbbbb';
  const tamperedCoreShare = '3-tampered';
  
  const hmacKey = process.env.CRYPTO_SERVICE_API_KEY || '';
  const validMac1 = crypto.createHmac('sha256', hmacKey).update(validCoreShare1).digest('hex');
  const validMac2 = crypto.createHmac('sha256', hmacKey).update(validCoreShare2).digest('hex');
  
  // Attacker recalculates using SHA256 (the old way) or an incorrect HMAC key
  const forgedMac3 = crypto.createHash('sha256').update(tamperedCoreShare).digest('hex');

  const shares = [
    `${validCoreShare1}:${validMac1}`,
    `${validCoreShare2}:${validMac2}`,
    `${tamperedCoreShare}:${forgedMac3}`
  ];
  await createCredential(record, shares);

  let responseData = null;
  const mockReq = { body: { credentialId: testId } };
  const mockRes = {
    status(s) { return this; },
    json(data) {
      responseData = data;
      return this;
    }
  };

  await verifyRoute(mockReq, mockRes);
  assert.equal(responseData.valid, false, 'Should reject verification due to forged MAC');
  assert.ok(responseData.reason.includes('Insufficient valid shares'), 'Reason should cite insufficient valid shares');
});
