// Automated Tests for Ops Dashboard Login Rate Limiting, Brute-Force Protection, and Lockout
// Remediates Audit Finding 5 (Section 2, Medium) / Issue #47

import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import supertest from 'supertest';

import { initDb, migrateUp } from '../db/migrations/runner.js';
import { createRepositories } from '../db/models/index.js';
import { hashPassword } from '../src/auth/passwords.js';
import { signToken } from '../src/auth/tokens.js';
import { AuthRateLimiter } from '../src/auth/rateLimiter.js';
import { createApp } from '../src/server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_DB_PATH = path.resolve(__dirname, 'test_login_lockout.db');

function cleanupTestDb() {
  for (const suffix of ['', '-wal', '-shm']) {
    const file = `${TEST_DB_PATH}${suffix}`;
    if (fs.existsSync(file)) {
      try { fs.unlinkSync(file); } catch (e) {}
    }
  }
}

describe('Ops Dashboard: Login Rate Limiting & Account Lockout (§2 Finding 5)', () => {
  let db;
  let repos;
  let request;
  let testLimiter;
  let rootToken;

  before(async () => {
    cleanupTestDb();
    const initResult = initDb(TEST_DB_PATH);
    db = initResult.db;
    migrateUp(db);
    repos = createRepositories(db);

    // Create test rate limiter with small thresholds for deterministic testing
    testLimiter = new AuthRateLimiter({
      maxAttempts: 5,
      lockoutDurationMs: 60000, // 1 minute
      ipMaxAttempts: 10,
      ipWindowMs: 60000
    });

    const appObj = createApp({ db, repos, rateLimiter: testLimiter });
    request = supertest(appObj.app);

    // Seed test users: 'test_operator' and 'root_admin'
    const passwordHash = await hashPassword('SecurePassword123!');
    repos.users.createUser({
      id: 'usr_lockout_01',
      username: 'test_operator',
      role: 'clerk',
      password_hash: passwordHash,
      station_id: 'STATION_A'
    });

    const rootHash = await hashPassword('RootPassword123!');
    const rootUser = repos.users.createUser({
      id: 'usr_lockout_root',
      username: 'root_admin',
      role: 'root',
      password_hash: rootHash,
      station_id: 'STATION_HQ'
    });

    rootToken = signToken({
      userId: rootUser.id,
      username: rootUser.username,
      role: rootUser.role,
      stationId: rootUser.station_id
    });
  });

  after(() => {
    if (db) {
      try { db.close(); } catch (e) {}
    }
    cleanupTestDb();
  });

  beforeEach(() => {
    testLimiter.reset();
  });

  describe('1. AuthRateLimiter Core Invariants', () => {
    test('1.1 initial state is unlocked with 0 attempts', () => {
      const state = testLimiter.isAccountLocked('test_operator');
      assert.strictEqual(state.locked, false);
      assert.strictEqual(state.attempts, 0);
    });

    test('1.2 tracks attempts and locks account when threshold reached', () => {
      for (let i = 1; i <= 4; i++) {
        const res = testLimiter.recordFailedAttempt('test_operator', '127.0.0.1');
        assert.strictEqual(res.accountLocked, false);
        assert.strictEqual(res.attempts, i);
      }

      // 5th attempt triggers lockout
      const fifth = testLimiter.recordFailedAttempt('test_operator', '127.0.0.1');
      assert.strictEqual(fifth.accountLocked, true);
      assert.strictEqual(fifth.attempts, 5);
      assert.ok(fifth.retryAfterSec > 0);

      const check = testLimiter.isAccountLocked('test_operator');
      assert.strictEqual(check.locked, true);
      assert.ok(check.retryAfterSec > 0);
    });

    test('1.3 unlockAccount clears lockout state', () => {
      for (let i = 1; i <= 5; i++) {
        testLimiter.recordFailedAttempt('test_operator', '127.0.0.1');
      }
      assert.strictEqual(testLimiter.isAccountLocked('test_operator').locked, true);

      const unlocked = testLimiter.unlockAccount('test_operator');
      assert.strictEqual(unlocked, true);
      assert.strictEqual(testLimiter.isAccountLocked('test_operator').locked, false);
    });

    test('1.4 recordSuccess clears failed attempts', () => {
      testLimiter.recordFailedAttempt('test_operator', '127.0.0.1');
      testLimiter.recordFailedAttempt('test_operator', '127.0.0.1');
      assert.strictEqual(testLimiter.isAccountLocked('test_operator').attempts, 2);

      testLimiter.recordSuccess('test_operator', '127.0.0.1');
      assert.strictEqual(testLimiter.isAccountLocked('test_operator').attempts, 0);
    });

    test('1.5 IP rate limiting triggers after ipMaxAttempts', () => {
      for (let i = 1; i <= 9; i++) {
        testLimiter.recordFailedAttempt(`user_${i}`, '192.168.1.100');
        assert.strictEqual(testLimiter.isIpRateLimited('192.168.1.100').limited, false);
      }

      testLimiter.recordFailedAttempt('user_10', '192.168.1.100');
      const ipCheck = testLimiter.isIpRateLimited('192.168.1.100');
      assert.strictEqual(ipCheck.limited, true);
      assert.ok(ipCheck.retryAfterSec > 0);
    });
  });

  describe('2. HTTP /api/auth/login Lockout Protection & Response Semantics', () => {
    test('2.1 four wrong passwords return 401 INVALID_CREDENTIALS', async () => {
      for (let i = 1; i <= 4; i++) {
        const res = await request
          .post('/api/auth/login')
          .set('X-Forwarded-For', '10.0.0.1')
          .send({ username: 'test_operator', password: 'WrongPassword!' });

        assert.strictEqual(res.status, 401);
        assert.strictEqual(res.body.error, 'INVALID_CREDENTIALS');
      }
    });

    test('2.2 fifth wrong password triggers 423 ACCOUNT_LOCKED with Retry-After header', async () => {
      for (let i = 1; i <= 4; i++) {
        await request
          .post('/api/auth/login')
          .set('X-Forwarded-For', '10.0.0.2')
          .send({ username: 'test_operator', password: 'WrongPassword!' });
      }

      const res = await request
        .post('/api/auth/login')
        .set('X-Forwarded-For', '10.0.0.2')
        .send({ username: 'test_operator', password: 'WrongPassword!' });

      assert.strictEqual(res.status, 423);
      assert.strictEqual(res.body.error, 'ACCOUNT_LOCKED');
      assert.ok(res.headers['retry-after']);
      assert.ok(parseInt(res.headers['retry-after'], 10) > 0);

      // Verify USER_ACCOUNT_LOCKED logged in audit trail
      const logs = repos.auditLog.getRecent(10);
      const lockedLog = logs.find(l => l.action === 'USER_ACCOUNT_LOCKED' && l.username === 'test_operator');
      assert.ok(lockedLog, 'USER_ACCOUNT_LOCKED event must be recorded in audit log');
      assert.strictEqual(lockedLog.status, 'ALERT');
    });

    test('2.3 locked account rejects even valid password while locked', async () => {
      // Trigger lockout
      for (let i = 1; i <= 5; i++) {
        await request
          .post('/api/auth/login')
          .set('X-Forwarded-For', '10.0.0.3')
          .send({ username: 'test_operator', password: 'WrongPassword!' });
      }

      // Attempt login with correct password
      const res = await request
        .post('/api/auth/login')
        .set('X-Forwarded-For', '10.0.0.3')
        .send({ username: 'test_operator', password: 'SecurePassword123!' });

      assert.strictEqual(res.status, 423);
      assert.strictEqual(res.body.error, 'ACCOUNT_LOCKED');
    });

    test('2.4 administrative unlock enables immediate login', async () => {
      // Lock account
      for (let i = 1; i <= 5; i++) {
        await request
          .post('/api/auth/login')
          .set('X-Forwarded-For', '10.0.0.4')
          .send({ username: 'test_operator', password: 'WrongPassword!' });
      }

      // Root calls /api/auth/unlock
      const unlockRes = await request
        .post('/api/auth/unlock')
        .set('Authorization', `Bearer ${rootToken}`)
        .send({ target_username: 'test_operator' });

      assert.strictEqual(unlockRes.status, 200);
      assert.strictEqual(unlockRes.body.success, true);
      assert.strictEqual(unlockRes.body.wasLocked, true);

      // Verify audit log recorded USER_ACCOUNT_UNLOCKED
      const logs = repos.auditLog.getRecent(5);
      const unlockLog = logs.find(l => l.action === 'USER_ACCOUNT_UNLOCKED');
      assert.ok(unlockLog, 'USER_ACCOUNT_UNLOCKED must be recorded in audit log');

      // Now valid login succeeds immediately
      const loginRes = await request
        .post('/api/auth/login')
        .set('X-Forwarded-For', '10.0.0.4')
        .send({ username: 'test_operator', password: 'SecurePassword123!' });

      assert.strictEqual(loginRes.status, 200);
      assert.ok(loginRes.body.token);
    });

    test('2.5 successful login resets attempt counter', async () => {
      // 3 failed attempts
      for (let i = 1; i <= 3; i++) {
        await request
          .post('/api/auth/login')
          .set('X-Forwarded-For', '10.0.0.5')
          .send({ username: 'test_operator', password: 'WrongPassword!' });
      }

      // 1 successful login
      const okRes = await request
        .post('/api/auth/login')
        .set('X-Forwarded-For', '10.0.0.5')
        .send({ username: 'test_operator', password: 'SecurePassword123!' });
      assert.strictEqual(okRes.status, 200);

      // Now 4 failed attempts shouldn't lock yet (counter was reset)
      for (let i = 1; i <= 4; i++) {
        const failRes = await request
          .post('/api/auth/login')
          .set('X-Forwarded-For', '10.0.0.5')
          .send({ username: 'test_operator', password: 'WrongPassword!' });
        assert.strictEqual(failRes.status, 401);
      }
    });

    test('2.6 IP rate limiting returns 429 TOO_MANY_REQUESTS', async () => {
      const fixedIp = '198.51.100.42';

      // 10 failed attempts from this IP across different user accounts
      for (let i = 1; i <= 10; i++) {
        await request
          .post('/api/auth/login')
          .set('X-Forwarded-For', fixedIp)
          .send({ username: `random_user_${i}`, password: 'SomePassword!' });
      }

      // 11th attempt from same IP is rate-limited
      const limitedRes = await request
        .post('/api/auth/login')
        .set('X-Forwarded-For', fixedIp)
        .send({ username: 'test_operator', password: 'SecurePassword123!' });

      assert.strictEqual(limitedRes.status, 429);
      assert.strictEqual(limitedRes.body.error, 'TOO_MANY_REQUESTS');
      assert.ok(limitedRes.headers['retry-after']);
    });
  });
});
