process.env.NODE_ENV = 'test';
process.env.SQLITE_DB_PATH = ':memory:';
process.env.VERIFICATION_API_KEY = 'test-auth-key-race';
process.env.REVOKE_API_KEY = 'test-revoke-key-race';
process.env.CRYPTO_SERVICE_API_KEY = 'test-crypto-key-race';

import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const { issueRoute } = await import('../src/routes/issue.js');
const { getAllCredentials, getCredentialByIdempotencyKey, clearDatabase } = await import('../src/db/models.js');

test('Idempotency Race: 50 simultaneous /issue requests with identical idempotencyKey (§4)', async () => {
  clearDatabase();
  const dataHash = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
  const sharedIdempotencyKey = `idemp-race-${randomUUID()}`;
  const CONCURRENCY = 50;

  // Mock global fetch for crypto-service
  const originalFetch = global.fetch;
  let signingCallCount = 0;

  global.fetch = async (url, options) => {
    signingCallCount++;
    // Simulate slight non-deterministic processing delay to encourage thread interleaving
    await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 10)));
    return {
      ok: true,
      json: async () => ({
        dataHash,
        signature: '3045022100abcd1234ef5678',
        publicKeyId: 'd1d2d3d4d5d6d7d8e9e0e1e2e3e4e5e6',
        algorithm: 'ML-DSA-65',
        issuedAt: '2026-09-05T14:00:00.000Z'
      })
    };
  };

  try {
    // Fire 50 simultaneous requests concurrently
    const requestPromises = Array.from({ length: CONCURRENCY }, async (_, idx) => {
      const mockReq = {
        body: {
          dataHash,
          idempotencyKey: sharedIdempotencyKey
        }
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

      await issueRoute(mockReq, mockRes);
      return { index: idx, status: mockRes.statusCode, body: mockRes.body };
    });

    const results = await Promise.all(requestPromises);

    // 1. Assert no request crashed with 500
    for (const res of results) {
      assert.notEqual(res.status, 500, `Request ${res.index} crashed with 500: ${JSON.stringify(res.body)}`);
      assert.ok(
        res.status === 200 || res.status === 201 || res.status === 202,
        `Request ${res.index} returned unexpected status: ${res.status}`
      );
    }

    // 2. Exactly one request performed initial insertion (201/202), and remaining 49 returned 200 OK
    const creatorResults = results.filter((r) => r.status === 201 || r.status === 202);
    const existingResults = results.filter((r) => r.status === 200);

    assert.equal(
      creatorResults.length,
      1,
      `Expected exactly 1 request to win insertion race, but found ${creatorResults.length}`
    );
    assert.equal(
      existingResults.length,
      CONCURRENCY - 1,
      `Expected ${CONCURRENCY - 1} requests to receive existing idempotent record, but found ${existingResults.length}`
    );

    // 3. All 50 requests must return the EXACT same credentialId
    const winningCredentialId = creatorResults[0].body.credentialId;
    assert.ok(winningCredentialId, 'Winning credential must have a valid credentialId');

    for (const res of results) {
      assert.equal(
        res.body.credentialId,
        winningCredentialId,
        `Request ${res.index} returned diverging credentialId: ${res.body.credentialId} vs ${winningCredentialId}`
      );
      assert.equal(res.body.dataHash, dataHash);
      assert.equal(res.body.algorithm, 'ML-DSA-65');
      assert.equal(res.body.publicKeyId, 'd1d2d3d4d5d6d7d8e9e0e1e2e3e4e5e6');
      assert.ok(res.body.signature, `Request ${res.index} missing signature in response`);
    }

    // 4. Verify database state: exactly 1 row exists in SQLite for this idempotency key
    const allCreds = await getAllCredentials();
    const matchingRows = allCreds.filter((c) => c.idempotencyKey === sharedIdempotencyKey);
    assert.equal(
      matchingRows.length,
      1,
      `Expected exactly 1 row in SQLite database for idempotency key, but found ${matchingRows.length}`
    );
    assert.equal(matchingRows[0].id, winningCredentialId);
  } finally {
    global.fetch = originalFetch;
  }
});

test('Idempotency Race: Sequential and interleaved concurrent bursts across multiple keys', async () => {
  clearDatabase();
  const NUM_KEYS = 5;
  const CONCURRENCY_PER_KEY = 10;
  const originalFetch = global.fetch;

  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      dataHash: '1111222233334444555566667777888811112222333344445555666677778888',
      signature: 'test-signature-bytes',
      publicKeyId: 'aabbccddeeff00112233445566778899',
      algorithm: 'ML-DSA-65',
      issuedAt: '2026-09-05T14:15:00.000Z'
    })
  });

  try {
    const keyPromises = Array.from({ length: NUM_KEYS }, async (_, kIdx) => {
      const idKey = `burst-key-${kIdx}-${randomUUID()}`;
      const dataHash = '1111222233334444555566667777888811112222333344445555666677778888';

      const burstPromises = Array.from({ length: CONCURRENCY_PER_KEY }, async () => {
        const mockReq = { body: { dataHash, idempotencyKey: idKey } };
        const mockRes = {
          statusCode: null,
          body: null,
          status(code) { this.statusCode = code; return this; },
          json(data) { this.body = data; return this; }
        };
        await issueRoute(mockReq, mockRes);
        return { status: mockRes.statusCode, id: mockRes.body.credentialId };
      });

      const burstResults = await Promise.all(burstPromises);
      const uniqueIds = new Set(burstResults.map((r) => r.id));
      assert.equal(uniqueIds.size, 1, `Key ${idKey} produced multiple distinct IDs: ${[...uniqueIds]}`);
      
      const dbRecord = await getCredentialByIdempotencyKey(idKey);
      assert.ok(dbRecord, `Record for ${idKey} must exist in DB`);
      assert.equal(dbRecord.id, [...uniqueIds][0]);
    });

    await Promise.all(keyPromises);
  } finally {
    global.fetch = originalFetch;
  }
});
