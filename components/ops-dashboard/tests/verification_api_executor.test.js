import test from 'node:test';
import assert from 'node:assert/strict';
import { createLedgerExecutor } from '../src/ledger/executor.js';

const savedEnv = {
  url: process.env.VERIFICATION_API_URL,
  key: process.env.VERIFICATION_API_KEY,
  revoke: process.env.REVOKE_API_KEY,
};
const originalFetch = globalThis.fetch;

test('issuance calls verification-api with approved commitment and idempotency key and returns real anchor receipt', async () => {
  process.env.VERIFICATION_API_URL = 'http://verification.test';
  process.env.VERIFICATION_API_KEY = 'api-key';
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options, body: JSON.parse(options.body) });
    return new Response(JSON.stringify({
      status: 'anchored', credentialId: 'credential-1', dataHash: 'a'.repeat(64),
      algorithm: 'ML-DSA-65', publicKeyId: 'key-1', signature: 'sig',
      anchorTxId: 'fabric-tx-1', issuedAt: '2026-01-01T00:00:00.000Z'
    }), { status: 201, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    const result = await createLedgerExecutor().executeIssuance({ id: 'req-stable-1', data_hash: 'A'.repeat(64) });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'http://verification.test/issue');
    assert.deepEqual(calls[0].body, { dataHash: 'a'.repeat(64), idempotencyKey: 'req-stable-1' });
    assert.equal(calls[0].options.headers.Authorization, 'Bearer api-key');
    assert.equal(result.txId, 'fabric-tx-1');
    assert.equal(result.issuanceReceipt.credentialId, 'credential-1');
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv();
  }
});

test('anchor_failed issuance retries the same credential through the API retry endpoint', async () => {
  process.env.VERIFICATION_API_URL = 'http://verification.test';
  process.env.VERIFICATION_API_KEY = 'api-key';
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(url);
    const response = calls.length === 1
      ? { status: 'anchor_failed', credentialId: 'credential-retry', reason: 'peer timeout' }
      : { status: 'anchored', credentialId: 'credential-retry', anchorTxId: 'fabric-tx-retry' };
    return new Response(JSON.stringify(response), { status: calls.length === 1 ? 202 : 200 });
  };
  try {
    const result = await createLedgerExecutor().executeIssuance({ id: 'req-retry', data_hash: 'b'.repeat(64) });
    assert.deepEqual(calls, [
      'http://verification.test/issue',
      'http://verification.test/issue/credential-retry/retry-anchor'
    ]);
    assert.equal(result.txId, 'fabric-tx-retry');
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv();
  }
});

test('pending idempotent issuance resumes anchoring after an interrupted API request', async () => {
  process.env.VERIFICATION_API_URL = 'http://verification.test';
  process.env.VERIFICATION_API_KEY = 'api-key';
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(url);
    const body = calls.length === 1
      ? { status: 'pending', credentialId: 'credential-pending', anchorTxId: null }
      : { status: 'anchored', credentialId: 'credential-pending', anchorTxId: 'fabric-tx-recovered' };
    return new Response(JSON.stringify(body), { status: 200 });
  };
  try {
    const result = await createLedgerExecutor().executeIssuance({ id: 'req-interrupted', data_hash: 'd'.repeat(64) });
    assert.deepEqual(calls, [
      'http://verification.test/issue',
      'http://verification.test/issue/credential-pending/retry-anchor'
    ]);
    assert.equal(result.txId, 'fabric-tx-recovered');
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv();
  }
});

test('revocation calls the protected API with the dedicated revoke key', async () => {
  process.env.VERIFICATION_API_URL = 'http://verification.test';
  process.env.VERIFICATION_API_KEY = 'api-key';
  process.env.REVOKE_API_KEY = 'separate-revoke-key';
  let call;
  globalThis.fetch = async (url, options) => {
    call = { url, options, body: JSON.parse(options.body) };
    return new Response(JSON.stringify({ success: true, credentialId: 'credential-9', status: 'revoked' }), { status: 200 });
  };
  try {
    const result = await createLedgerExecutor().executeRevocation({ credential_id: 'credential-9' });
    assert.equal(call.url, 'http://verification.test/revoke');
    assert.deepEqual(call.body, { credentialId: 'credential-9' });
    assert.equal(call.options.headers.Authorization, 'Bearer api-key');
    assert.equal(call.options.headers['X-Revoke-Key'], 'separate-revoke-key');
    assert.equal(result.status, 'revoked');
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv();
  }
});

test('missing verification API config and unconfirmed issue fail closed with no fabricated transaction ID', async () => {
  delete process.env.VERIFICATION_API_URL;
  delete process.env.VERIFICATION_API_KEY;
  try {
    await assert.rejects(() => createLedgerExecutor().executeIssuance({ id: 'req-no-config', data_hash: 'c'.repeat(64) }), /not configured/);
  } finally { restoreEnv(); }
});

function restoreEnv() {
  if (savedEnv.url === undefined) delete process.env.VERIFICATION_API_URL; else process.env.VERIFICATION_API_URL = savedEnv.url;
  if (savedEnv.key === undefined) delete process.env.VERIFICATION_API_KEY; else process.env.VERIFICATION_API_KEY = savedEnv.key;
  if (savedEnv.revoke === undefined) delete process.env.REVOKE_API_KEY; else process.env.REVOKE_API_KEY = savedEnv.revoke;
}
