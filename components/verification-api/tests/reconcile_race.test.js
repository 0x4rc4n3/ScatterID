process.env.NODE_ENV = 'test';
process.env.SQLITE_DB_PATH = ':memory:';
process.env.VERIFICATION_API_KEY = 'test-auth-key-reconcile';
process.env.REVOKE_API_KEY = 'test-revoke-key-reconcile';
process.env.CRYPTO_SERVICE_API_KEY = 'test-crypto-key-reconcile';

import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const { reconcileLedger, getReconciliationState } = await import('../src/reconcile.js');
const { issueRoute } = await import('../src/routes/issue.js');
const { revokeRoute } = await import('../src/routes/revoke.js');
const {
  createCredential,
  getCredentialById,
  getAllCredentials,
  getAuditLogs,
  updateStatus,
  clearDatabase
} = await import('../src/db/models.js');
const { setContractInstance } = await import('../src/chain/fabric.js');

test('Reconciliation vs. Live Writes: Mid-transaction in-flight issuance isolation (§4)', async () => {
  clearDatabase();
  // Scenario 1: A credential is inserted with status 'pending' (simulating mid-transaction /issue)
  const pendingId = randomUUID();
  await createCredential({
    id: pendingId,
    dataHash: '1111222233334444555566667777888811112222333344445555666677778888',
    algorithm: 'ML-DSA-65',
    signature: 'sig-pending',
    publicKeyId: 'pubkey-pending',
    anchorTxId: null,
    status: 'pending',
    issuedAt: new Date().toISOString()
  });

  // Mock contract where pendingId does not exist on ledger yet
  let queryCount = 0;
  const mockContract = {
    async evaluateTransaction(fn, id) {
      queryCount++;
      if (id === pendingId) {
        throw new Error(`the proof ${id} does not exist`);
      }
      return new TextEncoder().encode(JSON.stringify({ Status: 'active' }));
    }
  };

  setContractInstance(mockContract);

  try {
    // Run reconciliation while pending row exists
    const recState = await reconcileLedger();

    // Assert pending record was deliberately skipped — not flagged as discrepancy and not queried
    assert.equal(queryCount, 0, 'Reconcile daemon must skip records with status "pending"');
    assert.equal(recState.mismatchCount, 0, 'No mismatches should be reported for pending in-flight records');

    const pendingRecord = await getCredentialById(pendingId);
    assert.equal(pendingRecord.status, 'pending', 'Pending record must remain untouched by reconciliation');
  } finally {
    setContractInstance(null);
  }
});

test('Reconciliation vs. Live Writes: Concurrent burst of /issue and /revoke during active reconcile loops', async () => {
  clearDatabase();
  const NUM_CREDS = 10;
  const ledgerMap = new Map();

  // Mock contract supporting both AnchorProof, RevokeProof, and QueryProof
  const mockContract = {
    async submitAsync(fn, { arguments: [id, hash, issuer, ts] }) {
      await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 8) + 2));
      ledgerMap.set(id, 'active');
      return {
        getTransactionId: () => `tx-anchor-${id}`,
        getStatus: async () => ({ successful: true, code: 0 })
      };
    },
    async submitTransaction(fn, id) {
      await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 8) + 2));
      if (ledgerMap.get(id) === 'revoked') {
        throw new Error(`proof ${id} is already revoked`);
      }
      ledgerMap.set(id, 'revoked');
      return new TextEncoder().encode(JSON.stringify({ status: 'revoked' }));
    },
    async evaluateTransaction(fn, id) {
      await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 5)));
      const status = ledgerMap.get(id);
      if (!status) throw new Error(`the proof ${id} does not exist`);
      return new TextEncoder().encode(JSON.stringify({ Status: status }));
    }
  };

  setContractInstance(mockContract);

  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      dataHash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      signature: 'signature-concurrent',
      publicKeyId: 'pubkey-concurrent',
      algorithm: 'ML-DSA-65',
      issuedAt: new Date().toISOString()
    })
  });

  try {
    // Background worker running continuous reconciliation cycles
    let stopReconcile = false;
    let reconcileCyclesCompleted = 0;
    const reconcileErrors = [];

    const reconcilePromise = (async () => {
      while (!stopReconcile) {
        try {
          await reconcileLedger();
          reconcileCyclesCompleted++;
          await new Promise((r) => setTimeout(r, 10));
        } catch (err) {
          reconcileErrors.push(err.message);
        }
      }
    })();

    // Issue NUM_CREDS credentials concurrently
    const issuePromises = Array.from({ length: NUM_CREDS }, async (_, i) => {
      const dataHash = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      const mockReq = { body: { dataHash, idempotencyKey: `idemp-live-${i}-${randomUUID()}` } };
      const mockRes = {
        statusCode: null,
        body: null,
        status(s) { this.statusCode = s; return this; },
        json(d) { this.body = d; return this; }
      };
      await issueRoute(mockReq, mockRes);
      return mockRes.body;
    });

    const issuedCreds = await Promise.all(issuePromises);

    // Concurrently revoke half of the issued credentials
    const revokePromises = issuedCreds.slice(0, Math.floor(NUM_CREDS / 2)).map(async (cred) => {
      const mockReq = { body: { credentialId: cred.credentialId }, callerTier: 'revoke_api_key' };
      const mockRes = {
        statusCode: null,
        body: null,
        status(s) { this.statusCode = s; return this; },
        json(d) { this.body = d; return this; }
      };
      await revokeRoute(mockReq, mockRes);
      return mockRes.body;
    });

    await Promise.all(revokePromises);

    // Stop reconcile worker
    stopReconcile = true;
    await reconcilePromise;

    // Assert zero crashes during concurrent reconciliation
    assert.equal(reconcileErrors.length, 0, `Reconcile errors: ${reconcileErrors.join(', ')}`);
    assert.ok(reconcileCyclesCompleted >= 1, 'At least one reconciliation cycle must have completed');

    // Run final reconciliation cycle to verify steady-state convergence
    const finalState = await reconcileLedger();
    assert.equal(finalState.mismatchCount, 0, 'Final state must have zero mismatches');
  } finally {
    global.fetch = originalFetch;
    setContractInstance(null);
  }
});

test('Reconciliation Self-Healing: Heals anchor_failed to anchored when ledger is active (§4/§5)', async () => {
  clearDatabase();
  const credId = randomUUID();

  // Simulate distributed timeout scenario: Fabric anchored successfully, but API recorded anchor_failed
  await createCredential({
    id: credId,
    dataHash: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    algorithm: 'ML-DSA-65',
    signature: 'sig-timeout',
    publicKeyId: 'pub-timeout',
    anchorTxId: null,
    status: 'anchor_failed',
    issuedAt: new Date().toISOString()
  });

  const mockContract = {
    async evaluateTransaction(fn, id) {
      if (id === credId) {
        return new TextEncoder().encode(JSON.stringify({ Status: 'active', CredentialID: id }));
      }
      throw new Error(`the proof ${id} does not exist`);
    }
  };

  setContractInstance(mockContract);

  try {
    const preRecord = await getCredentialById(credId);
    assert.equal(preRecord.status, 'anchor_failed');

    const result = await reconcileLedger();
    assert.equal(result.mismatchCount, 1, 'Should detect 1 discrepancy between local DB and ledger');

    // Verify self-healing resolved the status to 'anchored'
    const postRecord = await getCredentialById(credId);
    assert.equal(postRecord.status, 'anchored', 'Must auto-heal anchor_failed to anchored');

    // Verify audit log recorded the healing event
    const auditLogs = getAuditLogs(20);
    const healEvent = auditLogs.find((l) => l.credentialId === credId && l.action === 'reconciliation_auto_healed');
    assert.ok(healEvent, 'Audit log must record reconciliation_auto_healed action');
    assert.equal(healEvent.status, 'healed_to_anchored');
  } finally {
    setContractInstance(null);
  }
});

test('Reconciliation Self-Healing: Heals anchored to revoked when ledger is revoked (§4/§5)', async () => {
  clearDatabase();
  const credId = randomUUID();

  // Simulate scenario where revocation occurred on ledger but local DB write crashed
  await createCredential({
    id: credId,
    dataHash: 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
    algorithm: 'ML-DSA-65',
    signature: 'sig-revoked-on-chain',
    publicKeyId: 'pub-revoked',
    anchorTxId: 'tx-123',
    status: 'anchored',
    issuedAt: new Date().toISOString()
  });

  const mockContract = {
    async evaluateTransaction(fn, id) {
      if (id === credId) {
        return new TextEncoder().encode(JSON.stringify({ Status: 'revoked', CredentialID: id }));
      }
      throw new Error(`the proof ${id} does not exist`);
    }
  };

  setContractInstance(mockContract);

  try {
    const result = await reconcileLedger();
    assert.equal(result.mismatchCount, 1);

    const postRecord = await getCredentialById(credId);
    assert.equal(postRecord.status, 'revoked', 'Must auto-heal anchored to revoked');

    const auditLogs = getAuditLogs(20);
    const healEvent = auditLogs.find((l) => l.credentialId === credId && l.status === 'healed_to_revoked');
    assert.ok(healEvent, 'Audit log must record healed_to_revoked');
  } finally {
    setContractInstance(null);
  }
});
