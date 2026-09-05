process.env.NODE_ENV = 'test';
process.env.SQLITE_DB_PATH = ':memory:';
process.env.VERIFICATION_API_KEY = 'test-auth-key-race';
process.env.REVOKE_API_KEY = 'test-revoke-key-race';
process.env.CRYPTO_SERVICE_API_KEY = 'test-crypto-key-race';

import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const { revokeRoute } = await import('../src/routes/revoke.js');
const { createCredential, getCredentialById, clearDatabase } = await import('../src/db/models.js');
const { setContractInstance } = await import('../src/chain/fabric.js');

test('Double-Revoke Race: Simultaneous /revoke calls for identical credential (§4)', async () => {
  clearDatabase();
  const credentialId = randomUUID();
  const dataHash = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
  const CONCURRENCY = 30;

  // Insert an active anchored credential
  await createCredential({
    id: credentialId,
    dataHash,
    algorithm: 'ML-DSA-65',
    signature: '3045022100abcd1234ef5678',
    publicKeyId: 'd1d2d3d4d5d6d7d8e9e0e1e2e3e4e5e6',
    anchorTxId: 'tx-anchor-init',
    status: 'anchored',
    issuedAt: new Date().toISOString(),
    idempotencyKey: `idemp-init-${credentialId}`
  });

  // Mock Fabric Contract maintaining single-authoritative state
  let ledgerStatus = 'active';
  let revokeTransactionCount = 0;

  const mockContract = {
    async submitTransaction(fn, id, issuer) {
      if (fn === 'RevokeProof') {
        revokeTransactionCount++;
        // Simulate real-world network and consensus latency
        await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 15) + 5));

        if (ledgerStatus === 'revoked') {
          throw new Error(`proof ${id} is already revoked`);
        }
        ledgerStatus = 'revoked';
        return new TextEncoder().encode(JSON.stringify({ status: 'revoked', credentialId: id }));
      }
      throw new Error(`Unsupported function ${fn}`);
    },
    async evaluateTransaction(fn, id) {
      if (fn === 'QueryProof') {
        return new TextEncoder().encode(JSON.stringify({
          CredentialID: id,
          Status: ledgerStatus,
          IssuerID: 'IssuerMSP'
        }));
      }
      throw new Error(`Unsupported function ${fn}`);
    }
  };

  setContractInstance(mockContract);

  try {
    // Fire 30 simultaneous revocation requests concurrently
    const requestPromises = Array.from({ length: CONCURRENCY }, async (_, idx) => {
      const mockReq = {
        body: { credentialId },
        callerTier: 'revoke_api_key'
      };
      const mockRes = {
        statusCode: null,
        body: null,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(data) {
          this.body = data;
          return this;
        }
      };

      await revokeRoute(mockReq, mockRes);
      return { index: idx, status: mockRes.statusCode, body: mockRes.body };
    });

    const results = await Promise.all(requestPromises);

    // 1. Assert every single request returned 200 OK
    for (const res of results) {
      assert.equal(
        res.status,
        200,
        `Request ${res.index} returned unexpected status ${res.status}: ${JSON.stringify(res.body)}`
      );
      assert.equal(res.body.success, true);
      assert.equal(res.body.credentialId, credentialId);
      assert.equal(res.body.status, 'revoked');
    }

    // 2. Assert ledger reached exactly 'revoked' state
    assert.equal(ledgerStatus, 'revoked', 'Ledger must end in revoked state');

    // 3. Assert local SQLite database reached 'revoked' state
    const dbRecord = await getCredentialById(credentialId);
    assert.ok(dbRecord, 'DB record must exist');
    assert.equal(dbRecord.status, 'revoked', 'Database record must be marked revoked');

    // 4. Subsequent sequential revoke calls must also return 200 without re-invoking ledger
    const ledgerCallsBefore = revokeTransactionCount;
    const seqReq = { body: { credentialId }, callerTier: 'revoke_api_key' };
    const seqRes = {
      statusCode: null,
      body: null,
      status(s) { this.statusCode = s; return this; },
      json(d) { this.body = d; return this; }
    };
    await revokeRoute(seqReq, seqRes);
    assert.equal(seqRes.statusCode, 200);
    assert.equal(seqRes.body.message, 'Credential is already revoked');
    assert.equal(revokeTransactionCount, ledgerCallsBefore, 'Subsequent revokes must hit fast-path cache');
  } finally {
    setContractInstance(null);
  }
});

test('Double-Revoke Race: Concurrent revocation on 5 distinct credentials simultaneously', async () => {
  clearDatabase();
  const BATCH_SIZE = 5;
  const CALLS_PER_ITEM = 6;
  const ledgerStates = {};

  const mockContract = {
    async submitTransaction(fn, id) {
      if (fn === 'RevokeProof') {
        await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 10)));
        if (ledgerStates[id] === 'revoked') {
          throw new Error(`proof ${id} is already revoked`);
        }
        ledgerStates[id] = 'revoked';
        return new TextEncoder().encode(JSON.stringify({ status: 'revoked' }));
      }
      throw new Error(`Unsupported ${fn}`);
    }
  };

  setContractInstance(mockContract);

  try {
    const credIds = await Promise.all(
      Array.from({ length: BATCH_SIZE }, async (_, i) => {
        const id = randomUUID();
        ledgerStates[id] = 'active';
        await createCredential({
          id,
          dataHash: '1111222233334444555566667777888811112222333344445555666677778888',
          algorithm: 'ML-DSA-65',
          signature: 'sig',
          publicKeyId: 'pubkey',
          anchorTxId: 'tx',
          status: 'anchored',
          issuedAt: new Date().toISOString()
        });
        return id;
      })
    );

    const allRequests = [];
    for (const id of credIds) {
      for (let j = 0; j < CALLS_PER_ITEM; j++) {
        allRequests.push((async () => {
          const res = {
            statusCode: null,
            body: null,
            status(s) { this.statusCode = s; return this; },
            json(d) { this.body = d; return this; }
          };
          await revokeRoute({ body: { credentialId: id }, callerTier: 'revoke_api_key' }, res);
          return { id, status: res.statusCode, body: res.body };
        })());
      }
    }

    const results = await Promise.all(allRequests);
    for (const r of results) {
      assert.equal(r.status, 200);
      assert.equal(r.body.status, 'revoked');
    }

    for (const id of credIds) {
      const record = await getCredentialById(id);
      assert.equal(record.status, 'revoked');
      assert.equal(ledgerStates[id], 'revoked');
    }
  } finally {
    setContractInstance(null);
  }
});
