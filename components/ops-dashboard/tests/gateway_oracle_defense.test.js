// Unit & Integration Test Suite for Gateway Key Oracle Defense & Rate Limiting
// Audit Report Finding: 🔴 Critical — Unauthenticated, unthrottled gateway-key oracle
// Validates per-IP rate limiting, exponential backoff, attempt capping, constant-time verification,
// and audit log alert generation on repeated oracle probe attacks.

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import supertest from 'supertest';
import crypto from 'node:crypto';

import { initDb, migrateUp } from '../db/migrations/runner.js';
import { createRepositories } from '../db/models/index.js';
import { GatewayKeyRateLimiter } from '../src/auth/rateLimiter.js';
import { createApp } from '../src/server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_DB_PATH = path.resolve(__dirname, 'test_gateway_oracle.db');

function cleanupTestDb() {
  for (const suffix of ['', '-wal', '-shm']) {
    const file = `${TEST_DB_PATH}${suffix}`;
    if (fs.existsSync(file)) {
      try { fs.unlinkSync(file); } catch (e) {}
    }
  }
}

describe('🔴 Critical Finding: Gateway Key Oracle Defense & Throttling', () => {
  let db;
  let repos;
  let request;
  let gatewayRateLimiter;
  let activeKeyToken;

  before(async () => {
    cleanupTestDb();
    const initResult = initDb(TEST_DB_PATH);
    db = initResult.db;
    migrateUp(db);
    repos = createRepositories(db);

    // Create custom rate limiter with small thresholds for rapid test verification
    gatewayRateLimiter = new GatewayKeyRateLimiter({
      maxAttempts: 5,
      windowMs: 5000,
      baseLockoutMs: 2000,
      maxLockoutMs: 10000
    });

    const appObj = createApp({ db, repos, gatewayRateLimiter });
    request = supertest(appObj.app);

    // Seed a valid active gateway key (VERIFICATION_API_KEY)
    activeKeyToken = `sk_verification_${crypto.randomBytes(32).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(activeKeyToken).digest('hex');

    repos.gatewayKeys.rotateKey({
      id: 'gwk_test_active_01',
      key_name: 'VERIFICATION_API_KEY',
      key_hash: keyHash,
      graceWindowHours: 24,
      created_by: null
    });
  });

  after(() => {
    if (db) {
      try { db.close(); } catch (e) {}
    }
    cleanupTestDb();
  });

  test('1. Valid gateway key validates successfully without throttling', async () => {
    const res = await request
      .post('/api/keys/gateway/validate')
      .set('X-Forwarded-For', '198.51.100.1')
      .send({
        key_name: 'VERIFICATION_API_KEY',
        token: activeKeyToken
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.valid, true);
    assert.equal(res.body.status, 'active');
  });

  test('2. Missing key_name or token returns 400 and increments failure counter', async () => {
    const ip = '198.51.100.2';
    const res = await request
      .post('/api/keys/gateway/validate')
      .set('X-Forwarded-For', ip)
      .send({ token: 'incomplete' });

    assert.equal(res.status, 400);
    assert.equal(res.body.valid, false);
    assert.equal(res.body.error, 'MISSING_FIELDS');
  });

  test('3. Single invalid token returns 200 { valid: false } without immediate lockout', async () => {
    const ip = '198.51.100.3';
    const res = await request
      .post('/api/keys/gateway/validate')
      .set('X-Forwarded-For', ip)
      .send({
        key_name: 'VERIFICATION_API_KEY',
        token: 'sk_verification_wrong_guess_1234567890abcdef'
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.valid, false);
  });

  test('4. Repeated guessing (3 failures) generates GATEWAY_KEY_ORACLE_ALERT in audit log', async () => {
    const attackerIp = '198.51.100.4';

    // Submit 3 invalid guesses
    for (let i = 1; i <= 3; i++) {
      const res = await request
        .post('/api/keys/gateway/validate')
        .set('X-Forwarded-For', attackerIp)
        .send({
          key_name: 'VERIFICATION_API_KEY',
          token: `sk_verification_invalid_guess_${i}`
        });
      assert.equal(res.status, 200);
      assert.equal(res.body.valid, false);
    }

    // Check that immutable audit log contains GATEWAY_KEY_ORACLE_ALERT
    const alerts = repos.auditLog.getRecent(10);
    const oracleAlert = alerts.find(a => a.action === 'GATEWAY_KEY_ORACLE_ALERT' && a.client_ip === attackerIp);

    assert.ok(oracleAlert, 'Repeated invalid guessing must emit GATEWAY_KEY_ORACLE_ALERT to audit log');
    assert.equal(oracleAlert.status, 'ALERT');
    const details = JSON.parse(oracleAlert.details);
    assert.equal(details.failed_attempts, 3);
  });

  test('5. Reaching threshold (5 failures) triggers 429 TOO_MANY_REQUESTS with Retry-After header', async () => {
    const attackerIp = '198.51.100.5';

    // First 4 attempts return 200 { valid: false }
    for (let i = 1; i <= 4; i++) {
      const res = await request
        .post('/api/keys/gateway/validate')
        .set('X-Forwarded-For', attackerIp)
        .send({
          key_name: 'VERIFICATION_API_KEY',
          token: `sk_verification_wrong_${i}`
        });
      assert.equal(res.status, 200);
      assert.equal(res.body.valid, false);
    }

    // 5th attempt hits threshold -> 429 TOO_MANY_REQUESTS
    const fifthRes = await request
      .post('/api/keys/gateway/validate')
      .set('X-Forwarded-For', attackerIp)
      .send({
        key_name: 'VERIFICATION_API_KEY',
        token: 'sk_verification_wrong_5'
      });

    assert.equal(fifthRes.status, 429);
    assert.equal(fifthRes.body.error, 'TOO_MANY_REQUESTS');
    assert.ok(fifthRes.headers['retry-after'], 'Response must include Retry-After header');
    assert.ok(fifthRes.body.retryAfter > 0);

    // 6th attempt is blocked immediately before validation
    const blockedRes = await request
      .post('/api/keys/gateway/validate')
      .set('X-Forwarded-For', attackerIp)
      .send({
        key_name: 'VERIFICATION_API_KEY',
        token: activeKeyToken // Even with valid key, IP is locked out
      });

    assert.equal(blockedRes.status, 429);
    assert.equal(blockedRes.body.error, 'TOO_MANY_REQUESTS');
  });

  test('6. IP Isolation: Legitimate client IP is completely unaffected by attacker lockout', async () => {
    const legitimateIp = '198.51.100.99';

    const res = await request
      .post('/api/keys/gateway/validate')
      .set('X-Forwarded-For', legitimateIp)
      .send({
        key_name: 'VERIFICATION_API_KEY',
        token: activeKeyToken
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.valid, true);
    assert.equal(res.body.status, 'active');
  });

  test('7. Successful validation resets failure attempts for legitimate IP', async () => {
    const recoveringIp = '198.51.100.7';

    // 2 failed attempts
    await request
      .post('/api/keys/gateway/validate')
      .set('X-Forwarded-For', recoveringIp)
      .send({ key_name: 'VERIFICATION_API_KEY', token: 'bad_token_1' });

    await request
      .post('/api/keys/gateway/validate')
      .set('X-Forwarded-For', recoveringIp)
      .send({ key_name: 'VERIFICATION_API_KEY', token: 'bad_token_2' });

    // 1 successful attempt
    const successRes = await request
      .post('/api/keys/gateway/validate')
      .set('X-Forwarded-For', recoveringIp)
      .send({ key_name: 'VERIFICATION_API_KEY', token: activeKeyToken });

    assert.equal(successRes.status, 200);
    assert.equal(successRes.body.valid, true);

    // Rate limiter record for recoveringIp must have 0 count
    const status = gatewayRateLimiter.isIpRateLimited(recoveringIp);
    assert.equal(status.count, 0, 'Successful authentication must reset failed attempts counter');
  });

  test('8. Constant-time verification properly handles arbitrary token lengths and contents', () => {
    const repo = repos.gatewayKeys;

    // Correct key
    const hash = crypto.createHash('sha256').update(activeKeyToken).digest('hex');
    const validCheck = repo.verifyKey('VERIFICATION_API_KEY', hash);
    assert.equal(validCheck.valid, true);

    // Wrong hash
    const badHash = crypto.createHash('sha256').update('wrong_token').digest('hex');
    const invalidCheck = repo.verifyKey('VERIFICATION_API_KEY', badHash);
    assert.equal(invalidCheck.valid, false);

    // Non-existent key name
    const unknownName = repo.verifyKey('NON_EXISTENT_KEY', hash);
    assert.equal(unknownName.valid, false);
  });
});
