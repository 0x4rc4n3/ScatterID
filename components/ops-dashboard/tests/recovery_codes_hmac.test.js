// Automated Tests for Ops Dashboard Peppered HMAC-SHA256 Recovery Codes
// Remediates Audit Finding 7 (Section 2, Low) / Issue #49

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import supertest from 'supertest';

import { initDb, migrateUp } from '../db/migrations/runner.js';
import { createRepositories } from '../db/models/index.js';
import { hashPassword } from '../src/auth/passwords.js';
import { encryptTotpSecret, generateTotpSecret } from '../src/auth/totp.js';
import {
  getRecoveryCodePepper,
  generateSingleRecoveryCode,
  generateRecoveryCodesBatch,
  normalizeRecoveryCode,
  hashRecoveryCode,
  hashRecoveryCodeLegacy,
  verifyRecoveryCodeMatch
} from '../src/auth/recoveryCodes.js';
import { createApp } from '../src/server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_DB_PATH = path.resolve(__dirname, 'test_recovery_hmac.db');

function cleanupTestDb() {
  for (const suffix of ['', '-wal', '-shm']) {
    const file = `${TEST_DB_PATH}${suffix}`;
    if (fs.existsSync(file)) {
      try { fs.unlinkSync(file); } catch (e) {}
    }
  }
}

describe('Ops Dashboard: Peppered HMAC-SHA256 Recovery Codes (§2 Finding 7)', () => {
  let db;
  let repos;
  let request;

  before(async () => {
    cleanupTestDb();
    const initResult = initDb(TEST_DB_PATH);
    db = initResult.db;
    migrateUp(db);
    repos = createRepositories(db);

    const appObj = createApp({ db, repos });
    request = supertest(appObj.app);
  });

  after(() => {
    if (db) {
      try { db.close(); } catch (e) {}
    }
    cleanupTestDb();
  });

  describe('1. HMAC Pepper Configuration & Fail-Fast Invariants', () => {
    test('1.1 returns custom RECOVERY_CODE_PEPPER when validly configured', () => {
      const orig = process.env.RECOVERY_CODE_PEPPER;
      try {
        process.env.RECOVERY_CODE_PEPPER = 'custom-test-recovery-pepper-32bytes!!';
        assert.strictEqual(getRecoveryCodePepper(), 'custom-test-recovery-pepper-32bytes!!');
      } finally {
        if (orig !== undefined) process.env.RECOVERY_CODE_PEPPER = orig;
        else delete process.env.RECOVERY_CODE_PEPPER;
      }
    });

    test('1.2 throws error when RECOVERY_CODE_PEPPER entropy is below 16 bytes', () => {
      const orig = process.env.RECOVERY_CODE_PEPPER;
      try {
        process.env.RECOVERY_CODE_PEPPER = 'too-short';
        assert.throws(() => getRecoveryCodePepper(), /at least 16 bytes/);
      } finally {
        if (orig !== undefined) process.env.RECOVERY_CODE_PEPPER = orig;
        else delete process.env.RECOVERY_CODE_PEPPER;
      }
    });

    test('1.3 throws error in production when RECOVERY_CODE_PEPPER is missing', () => {
      const origEnv = process.env.NODE_ENV;
      const origPepper = process.env.RECOVERY_CODE_PEPPER;
      try {
        process.env.NODE_ENV = 'production';
        delete process.env.RECOVERY_CODE_PEPPER;
        assert.throws(() => getRecoveryCodePepper(), /required in production/);
      } finally {
        process.env.NODE_ENV = origEnv;
        if (origPepper !== undefined) process.env.RECOVERY_CODE_PEPPER = origPepper;
      }
    });
  });

  describe('2. HMAC Hashing & Pepper Sensitivity Invariants', () => {
    test('2.1 identical codes with different peppers produce distinct hashes', () => {
      const code = '4D9K-7W2P-8QXM';
      const hashA = hashRecoveryCode(code, 'pepper-alpha-0123456789abcdef');
      const hashB = hashRecoveryCode(code, 'pepper-bravo-0123456789abcdef');

      assert.strictEqual(hashA.length, 64);
      assert.strictEqual(hashB.length, 64);
      assert.notStrictEqual(hashA, hashB, 'Different peppers must produce different hashes');
    });

    test('2.2 keyed HMAC hash differs from unkeyed legacy SHA-256 hash', () => {
      const code = '4D9K-7W2P-8QXM';
      const hmacHash = hashRecoveryCode(code, 'some-random-server-side-pepper');
      const legacyHash = hashRecoveryCodeLegacy(code);

      assert.notStrictEqual(hmacHash, legacyHash, 'Keyed HMAC-SHA256 must not match bare unkeyed SHA-256');
    });

    test('2.3 normalization produces identical HMAC hash regardless of formatting', () => {
      const pepper = 'consistent-test-pepper-12345678';
      const h1 = hashRecoveryCode('4D9K-7W2P-8QXM', pepper);
      const h2 = hashRecoveryCode('4d9k-7w2p-8qxm', pepper);
      const h3 = hashRecoveryCode('4d9k 7w2p 8qxm', pepper);
      const h4 = hashRecoveryCode('4D9K7W2P8QXM', pepper);

      assert.strictEqual(h1, h2);
      assert.strictEqual(h2, h3);
      assert.strictEqual(h3, h4);
    });
  });

  describe('3. Backward-Compatible Verification Matrix', () => {
    test('3.1 verifyRecoveryCodeMatch validates keyed HMAC hashes', () => {
      const code = 'ABCD-EFGH-1234';
      const pepper = 'test-pepper-matrix-1234567890';
      const validHmac = hashRecoveryCode(code, pepper);

      assert.strictEqual(verifyRecoveryCodeMatch(code, validHmac, pepper), true);
      assert.strictEqual(verifyRecoveryCodeMatch('WRONG-CODE-1234', validHmac, pepper), false);
    });

    test('3.2 verifyRecoveryCodeMatch validates legacy unkeyed SHA-256 hashes', () => {
      const code = 'LEGACY-CODE-9999';
      const legacyHash = hashRecoveryCodeLegacy(code);
      const pepper = 'test-pepper-matrix-1234567890';

      // Must verify true against legacy hash even when a pepper is active
      assert.strictEqual(verifyRecoveryCodeMatch(code, legacyHash, pepper), true);
      assert.strictEqual(verifyRecoveryCodeMatch('WRONG-CODE-9999', legacyHash, pepper), false);
    });
  });

  describe('4. End-to-End Login Verification with Peppered & Legacy Codes', () => {
    test('4.1 operator authenticates using newly minted peppered recovery code', async () => {
      const password = 'PepperedOperator2026!';
      const passwordHash = await hashPassword(password);
      const secret = encryptTotpSecret(generateTotpSecret());

      const user = repos.users.createUser({
        id: 'usr_rc_peppered',
        username: 'rc_peppered_user',
        role: 'mod',
        password_hash: passwordHash,
        totp_secret: secret,
        totp_enabled: 1,
        station_id: 'STATION_PEPPER'
      });

      const rawCodes = generateRecoveryCodesBatch(8);
      // Persist codes using the new hashRecoveryCode (HMAC-SHA256)
      const codeHashes = rawCodes.map(c => hashRecoveryCode(c));
      repos.recoveryCodes.saveCodesForUser(user.id, codeHashes);

      assert.strictEqual(repos.recoveryCodes.getRemainingCount(user.id), 8);

      // Login using the first recovery code
      const loginRes = await request
        .post('/api/auth/login')
        .send({
          username: 'rc_peppered_user',
          password,
          recovery_code: rawCodes[0]
        });

      assert.strictEqual(loginRes.status, 200);
      assert.ok(loginRes.body.token);
      assert.strictEqual(repos.recoveryCodes.getRemainingCount(user.id), 7);

      // Replay attack: attempting to reuse the same recovery code fails
      const replayRes = await request
        .post('/api/auth/login')
        .send({
          username: 'rc_peppered_user',
          password,
          recovery_code: rawCodes[0]
        });

      assert.strictEqual(replayRes.status, 401);
      assert.strictEqual(replayRes.body.error, 'INVALID_MFA_TOKEN');
    });

    test('4.2 operator authenticates using legacy unkeyed SHA-256 recovery code', async () => {
      const password = 'LegacyOperator2026!';
      const passwordHash = await hashPassword(password);
      const secret = encryptTotpSecret(generateTotpSecret());

      const user = repos.users.createUser({
        id: 'usr_rc_legacy',
        username: 'rc_legacy_user',
        role: 'root',
        password_hash: passwordHash,
        totp_secret: secret,
        totp_enabled: 1,
        station_id: 'STATION_LEGACY'
      });

      const rawLegacyCode = 'LEGA-CY99-CODE';
      // Store using old unkeyed SHA-256
      const legacyHash = hashRecoveryCodeLegacy(rawLegacyCode);
      repos.recoveryCodes.saveCodesForUser(user.id, [legacyHash]);

      // Login using legacy unkeyed code (server fallback succeeds)
      const loginRes = await request
        .post('/api/auth/login')
        .send({
          username: 'rc_legacy_user',
          password,
          recovery_code: rawLegacyCode
        });

      assert.strictEqual(loginRes.status, 200);
      assert.ok(loginRes.body.token);
      assert.strictEqual(repos.recoveryCodes.getRemainingCount(user.id), 0);
    });
  });
});
