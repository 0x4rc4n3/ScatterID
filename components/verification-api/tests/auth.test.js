/**
 * HTTP-level authentication enforcement tests on the REAL Express server.
 *
 * These tests boot the actual `app` exported from `src/server.js` (including
 * its complete middleware pipeline, helmet security headers, rate limiters,
 * and real route registrations).
 *
 * Unlike unit tests that call route functions in isolation, this suite
 * verifies that the live Express application wiring correctly gates all
 * protected endpoints behind timing-safe authentication.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

// Set required environment variables before importing the real server module
const TEST_KEY = 'test-auth-key-for-ci-only';
const TEST_REVOKE_KEY = 'test-revoke-key-for-ci-only';
const TEST_CRYPTO_KEY = 'test-crypto-key-for-ci-only';
process.env.VERIFICATION_API_KEY = TEST_KEY;
process.env.REVOKE_API_KEY = TEST_REVOKE_KEY;
process.env.CRYPTO_SERVICE_API_KEY = TEST_CRYPTO_KEY;
process.env.SQLITE_DB_PATH = ':memory:';
process.env.NODE_ENV = 'test';

// Import the REAL Express application from server.js (NOT a testApp clone)
const { app } = await import('../src/server.js');

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

// Boot the real server instance once before all tests
before(async () => {
  await startServer();
});

// ── Auth enforcement tests on the REAL Express application ────────────────────

test('POST /issue — 401 with no Authorization header', async () => {
  const res = await fetch(`${baseUrl}/issue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataHash: 'a'.repeat(64) })
  });
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.equal(body.code, 'MISSING_AUTH');
});

test('POST /issue — 401 with wrong Bearer token', async () => {
  const res = await fetch(`${baseUrl}/issue`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer wrong-token'
    },
    body: JSON.stringify({ dataHash: 'a'.repeat(64) })
  });
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.equal(body.code, 'INVALID_AUTH');
});

test('POST /issue — auth passes with valid Bearer token and reaches route handler', async () => {
  // With bad params, it returns 400 INVALID_PARAMETER, proving it passed auth and reached issueRoute
  const res = await fetch(`${baseUrl}/issue`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TEST_KEY}`
    },
    body: JSON.stringify({ dataHash: 'invalid-non-hex' })
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.code, 'INVALID_PARAMETER');
});

test('GET /status/:id — 401 with no auth', async () => {
  const res = await fetch(`${baseUrl}/status/00000000-0000-4000-8000-000000000000`);
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.equal(body.code, 'MISSING_AUTH');
});

test('GET /status/:id — auth passes with valid Bearer token and queries DB', async () => {
  const res = await fetch(`${baseUrl}/status/00000000-0000-4000-8000-000000000000`, {
    headers: { 'Authorization': `Bearer ${TEST_KEY}` }
  });
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.equal(body.code, 'NOT_FOUND');
});

test('GET /credentials — 401 with no auth', async () => {
  const res = await fetch(`${baseUrl}/credentials`);
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.equal(body.code, 'MISSING_AUTH');
});

test('GET /credentials — 401 with length-mismatched token (no length oracle)', async () => {
  const shortToken = TEST_KEY.slice(0, 4);
  const res = await fetch(`${baseUrl}/credentials`, {
    headers: { 'Authorization': `Bearer ${shortToken}` }
  });
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.equal(body.code, 'INVALID_AUTH');
});

test('GET /credentials — 200 with correct Bearer token', async () => {
  const res = await fetch(`${baseUrl}/credentials`, {
    headers: { 'Authorization': `Bearer ${TEST_KEY}` }
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.ok(Array.isArray(body.credentials));
});

test('POST /verify — 400 or valid response without any auth (public endpoint)', async () => {
  // /verify is intentionally open to third-party verifiers.
  const res = await fetch(`${baseUrl}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataHash: 'invalid-hash' })
  });
  assert.equal(res.status, 400, '/verify should be accessible without auth and validate inputs');
});

test('GET /healthz — 200 without any auth (health probe)', async () => {
  const res = await fetch(`${baseUrl}/healthz`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'ok');
});

test('POST /revoke — 401 with no Authorization header', async () => {
  const res = await fetch(`${baseUrl}/revoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credentialId: '00000000-0000-4000-8000-000000000000' })
  });
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.equal(body.code, 'MISSING_REVOKE_AUTH');
});

test('POST /revoke — 403 with wrong Bearer token or invalid revoke key', async () => {
  const res = await fetch(`${baseUrl}/revoke`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer wrong-token'
    },
    body: JSON.stringify({ credentialId: '00000000-0000-4000-8000-000000000000' })
  });
  assert.equal(res.status, 403);
  const body = await res.json();
  assert.equal(body.code, 'REVOCATION_UNAUTHORIZED');
});

test('POST /revoke — auth passes with valid Bearer token and validates input', async () => {
  const res = await fetch(`${baseUrl}/revoke`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TEST_REVOKE_KEY}`
    },
    body: JSON.stringify({ credentialId: 'invalid-uuid' })
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.code, 'INVALID_PARAMETER');
});

test('POST /issue/:id/retry-anchor — 401 without auth', async () => {
  const res = await fetch(`${baseUrl}/issue/00000000-0000-4000-8000-000000000000/retry-anchor`, {
    method: 'POST'
  });
  assert.equal(res.status, 401);
});

test('GET /audit — 401 without auth, 200 with auth', async () => {
  const unauthRes = await fetch(`${baseUrl}/audit`);
  assert.equal(unauthRes.status, 401);

  const authRes = await fetch(`${baseUrl}/audit`, {
    headers: { 'Authorization': `Bearer ${TEST_KEY}` }
  });
  assert.equal(authRes.status, 200);
  const body = await authRes.json();
  assert.equal(body.success, true);
  assert.ok(Array.isArray(body.logs));
});

test('GET /reconciliation — 401 without auth, 200 with auth', async () => {
  const unauthRes = await fetch(`${baseUrl}/reconciliation`);
  assert.equal(unauthRes.status, 401);

  const authRes = await fetch(`${baseUrl}/reconciliation`, {
    headers: { 'Authorization': `Bearer ${TEST_KEY}` }
  });
  assert.equal(authRes.status, 200);
  const body = await authRes.json();
  assert.equal(body.success, true);
  assert.equal(typeof body.mismatchCount, 'number');
});

test('startup fails if REVOKE_API_KEY equals VERIFICATION_API_KEY', async () => {
  const { spawnSync } = await import('node:child_process');
  const result = spawnSync('node', ['src/server.js'], {
    cwd: new URL('..', import.meta.url).pathname,
    env: {
      ...process.env,
      VERIFICATION_API_KEY: 'shared-identical-key',
      REVOKE_API_KEY: 'shared-identical-key',
      CRYPTO_SERVICE_API_KEY: 'crypto-key'
    },
    encoding: 'utf8'
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /REVOKE_API_KEY must not match VERIFICATION_API_KEY/);
});

// Shut down the real test server after all tests
after(async () => {
  await stopServer();
});

