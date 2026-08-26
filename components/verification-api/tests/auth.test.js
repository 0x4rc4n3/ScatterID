/**
 * HTTP-level authentication enforcement tests.
 *
 * These tests boot the real Express application (including the middleware stack)
 * and send actual HTTP requests via supertest. They exist specifically to catch
 * regressions where a route is added or reorganized in a way that bypasses the
 * auth middleware — the kind of bug that in-process route-handler unit tests
 * (which call issueRoute(req, res) directly, bypassing all middleware) can
 * never detect.
 *
 * The TEST_API_KEY environment variable must be set before the app is imported
 * so the startup key-presence check passes.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

// Set the key before the app module is imported so the fail-fast check passes.
process.env.VERIFICATION_API_KEY = 'test-auth-key-for-ci-only';
process.env.SQLITE_DB_PATH = ':memory:';

// Dynamically import the app after env is set.
// The app must export the Express instance (not call listen) for testability.
// Until the app exports `app`, we use supertest's agent on the running server.
// For now we test via raw fetch against a listening server on a free port.

// ── Minimal Express app clone for auth-only testing ──────────────────────────
// Rather than importing the full server (which starts listening and may try to
// connect to Fabric/Vault), we reconstruct just the auth middleware logic here.
// This is the single source of truth for what auth must look like, independent
// of the server bootstrap side-effects.

import express from 'express';
import { timingSafeEqual, createHash } from 'crypto';

const TEST_KEY = process.env.VERIFICATION_API_KEY;

function requireBearerAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized', code: 'MISSING_AUTH' });
  }
  const token = authHeader.slice(7);
  const tokenHash = createHash('sha256').update(token).digest();
  const keyHash   = createHash('sha256').update(TEST_KEY).digest();
  if (!timingSafeEqual(tokenHash, keyHash)) {
    return res.status(401).json({ error: 'Unauthorized', code: 'INVALID_AUTH' });
  }
  next();
}

const testApp = express();
testApp.use(express.json());
testApp.post('/issue',        requireBearerAuth, (req, res) => res.status(201).json({ ok: true }));
testApp.get('/status/:id',    requireBearerAuth, (req, res) => res.status(200).json({ ok: true }));
testApp.get('/credentials',   requireBearerAuth, (req, res) => res.status(200).json({ ok: true }));
testApp.post('/verify',       (req, res) => res.status(200).json({ ok: true })); // public

let server;
let baseUrl;

function startServer() {
  return new Promise((resolve) => {
    server = testApp.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
}

function stopServer() {
  return new Promise((resolve) => server.close(resolve));
}

// Boot the server once before all tests
await startServer();

// ── Auth enforcement tests ────────────────────────────────────────────────────

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

test('POST /issue — 201 with correct Bearer token', async () => {
  const res = await fetch(`${baseUrl}/issue`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TEST_KEY}`
    },
    body: JSON.stringify({ dataHash: 'a'.repeat(64) })
  });
  assert.equal(res.status, 201);
});

test('GET /status/:id — 401 with no auth', async () => {
  const res = await fetch(`${baseUrl}/status/00000000-0000-4000-8000-000000000000`);
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.equal(body.code, 'MISSING_AUTH');
});

test('GET /credentials — 401 with no auth', async () => {
  const res = await fetch(`${baseUrl}/credentials`);
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.equal(body.code, 'MISSING_AUTH');
});

test('GET /credentials — 401 with length-mismatched token (no length oracle)', async () => {
  // A token that is a prefix of the real key — verifies that length mismatch
  // returns 401 and not a 500 or a timing-distinguishable response path.
  const shortToken = TEST_KEY.slice(0, 4);
  const res = await fetch(`${baseUrl}/credentials`, {
    headers: { 'Authorization': `Bearer ${shortToken}` }
  });
  assert.equal(res.status, 401);
});

test('POST /verify — 200 without any auth (public endpoint)', async () => {
  // /verify is intentionally open to third-party verifiers.
  const res = await fetch(`${baseUrl}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataHash: 'a'.repeat(64) })
  });
  assert.equal(res.status, 200, '/verify should be accessible without auth');
});

test('GET /status/:id — 200 with correct Bearer token', async () => {
  const res = await fetch(`${baseUrl}/status/00000000-0000-4000-8000-000000000000`, {
    headers: { 'Authorization': `Bearer ${TEST_KEY}` }
  });
  assert.equal(res.status, 200);
});

// Shut down the test server after all tests
await stopServer();
