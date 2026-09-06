// Automated Unit & Integration Tests for Phase 2: Authentication & TOTP MFA Engine
// Tests Argon2id, RFC 6238 TOTP, Self-Service Phone Migration, Single-Use Recovery Codes, and RBAC

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import supertest from 'supertest';

import { initDb, migrateUp } from '../db/migrations/runner.js';
import { createRepositories } from '../db/models/index.js';
import { hashPassword, verifyPassword } from '../src/auth/passwords.js';
import {
  generateTotpSecret,
  generateTotpCode,
  verifyTotpCode,
  encryptTotpSecret,
  decryptTotpSecret,
  getTotpUri,
  generateQrDataUrl,
  generateQrTerminalString
} from '../src/auth/totp.js';
import {
  generateRecoveryCodesBatch,
  hashRecoveryCode,
  normalizeRecoveryCode
} from '../src/auth/recoveryCodes.js';
import { signToken, verifyToken } from '../src/auth/tokens.js';
import { createApp } from '../src/server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_DB_PATH = path.resolve(__dirname, 'test_auth.db');

function cleanupTestDb() {
  for (const suffix of ['', '-wal', '-shm']) {
    const file = `${TEST_DB_PATH}${suffix}`;
    if (fs.existsSync(file)) {
      try { fs.unlinkSync(file); } catch (e) {}
    }
  }
}

describe('Phase 2: Authentication & TOTP MFA Engine', () => {
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

  test('1. Argon2id Password Hashing & Verification', async () => {
    const plain = 'ScatterID@Secret2026!';
    const hashed = await hashPassword(plain);

    assert.ok(hashed.startsWith('$argon2id$'), 'Hash must be in Argon2id format');
    
    const valid = await verifyPassword(hashed, plain);
    assert.equal(valid, true, 'Correct password must verify');

    const invalid = await verifyPassword(hashed, 'WrongPassword123');
    assert.equal(invalid, false, 'Incorrect password must fail verification');

    const empty = await verifyPassword(hashed, '');
    assert.equal(empty, false, 'Empty password must fail verification');
  });

  test('2. RFC 6238 TOTP Engine & AES-256-GCM Secret Encryption', async () => {
    const secret = generateTotpSecret();
    assert.ok(secret.length >= 32, 'Base32 secret must be at least 32 characters');

    // Generate valid TOTP token for current time
    const now = Date.now();
    const currentCode = generateTotpCode(secret, now);
    assert.match(currentCode, /^\d{6}$/, 'TOTP code must be 6 digits');

    // Verify valid code
    const isValid = verifyTotpCode(secret, currentCode, 1, now);
    assert.equal(isValid, true, 'Generated code must verify');

    // Reject wrong code
    const isBadValid = verifyTotpCode(secret, '000000', 1, now);
    assert.equal(isBadValid, false, 'Arbitrary code must not verify');

    // Window drift: ±30s (1 step) should verify, 90s drift should fail with window=1
    const driftedCode90s = generateTotpCode(secret, now + 90 * 1000);
    const isDriftAccepted = verifyTotpCode(secret, driftedCode90s, 1, now);
    assert.equal(isDriftAccepted, false, '90s drift code must fail with window=1');

    // AES-256-GCM Secret Encryption / Decryption roundtrip
    const encrypted = encryptTotpSecret(secret);
    assert.ok(encrypted.startsWith('enc:v1:'), 'Encrypted secret must have versioned header');
    assert.notEqual(encrypted, secret, 'Ciphertext must not match plaintext');

    const decrypted = decryptTotpSecret(encrypted);
    assert.equal(decrypted, secret, 'Decrypted secret must match original Base32 secret');

    // QR generation
    const uri = getTotpUri(secret, 'admin_root');
    assert.ok(uri.startsWith('otpauth://totp/'), 'URI must have otpauth scheme');

    const dataUrl = await generateQrDataUrl(uri);
    assert.ok(dataUrl.startsWith('data:image/png;base64,'), 'QR data URL must be generated');

    const terminalAscii = await generateQrTerminalString(uri);
    assert.ok(terminalAscii.length > 50, 'ASCII QR string must be generated for terminal');
  });

  test('3. Recovery Codes Batch Generation, Normalization & Hashing', () => {
    const codes = generateRecoveryCodesBatch(8);
    assert.equal(codes.length, 8, 'Must generate exactly 8 recovery codes');

    for (const code of codes) {
      assert.match(code, /^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/, 'Code must match XXXX-XXXX-XXXX pattern');
    }

    const raw = 'abcd-efgh-1234';
    assert.equal(normalizeRecoveryCode(raw), 'ABCDEFGH1234');

    const hash1 = hashRecoveryCode('AAAA-BBBB-CCCC');
    const hash2 = hashRecoveryCode('aaaa bbbb cccc');
    assert.equal(hash1, hash2, 'Normalization must produce identical SHA-256 hash regardless of spaces/case');
  });

  test('4. Session Tokens & Structural Role-Based Middleware', () => {
    const token = signToken({
      userId: 'usr_test_01',
      username: 'test_admin',
      role: 'root'
    }, 3600);

    const decoded = verifyToken(token);
    assert.equal(decoded.userId, 'usr_test_01');
    assert.equal(decoded.role, 'root');

    // Malformed token rejection
    assert.throws(() => {
      verifyToken(token + 'tampered');
    }, /Invalid token signature/i);

    // Expired token rejection
    const expiredToken = signToken({ userId: 'exp_01' }, -10);
    assert.throws(() => {
      verifyToken(expiredToken);
    }, /Token has expired/i);
  });

  test('5. Help Desk Clerk Authentication (Password Only)', async () => {
    const password = 'ClerkPassword2026!';
    const passwordHash = await hashPassword(password);

    repos.users.createUser({
      id: 'clk_auth_01',
      username: 'clerk_dan',
      password_hash: passwordHash,
      role: 'clerk',
      station_id: 'station-north-1'
    });

    // Valid login
    const res = await request
      .post('/api/auth/login')
      .send({ username: 'clerk_dan', password });

    assert.equal(res.status, 200);
    assert.ok(res.body.token);
    assert.equal(res.body.user.role, 'clerk');
    assert.equal(res.body.user.station_id, 'station-north-1');

    // Invalid password
    const failRes = await request
      .post('/api/auth/login')
      .send({ username: 'clerk_dan', password: 'WrongPassword!' });

    assert.equal(failRes.status, 401);
  });

  test('6. Mod & Root Authentication (Mandatory TOTP & Recovery Code)', async () => {
    const password = 'RootMasterPassword2026!';
    const passwordHash = await hashPassword(password);
    const rootSecret = generateTotpSecret();
    const encryptedSecret = encryptTotpSecret(rootSecret);

    repos.users.createUser({
      id: 'root_auth_01',
      username: 'root_elena',
      password_hash: passwordHash,
      role: 'root',
      totp_secret: encryptedSecret,
      totp_enabled: 1
    });

    // Save recovery codes
    const rawCodes = generateRecoveryCodesBatch(8);
    const codeHashes = rawCodes.map(hashRecoveryCode);
    repos.recoveryCodes.saveCodesForUser('root_auth_01', codeHashes);

    // Login without TOTP code or recovery code must be rejected with 401 MFA_REQUIRED
    const missingMfaRes = await request
      .post('/api/auth/login')
      .send({ username: 'root_elena', password });

    assert.equal(missingMfaRes.status, 401);
    assert.equal(missingMfaRes.body.error, 'MFA_REQUIRED');
    assert.equal(missingMfaRes.body.mfaRequired, true);

    // Login with invalid TOTP code fails
    const badMfaRes = await request
      .post('/api/auth/login')
      .send({ username: 'root_elena', password, totp_code: '000000' });

    assert.equal(badMfaRes.status, 401);

    // Login with valid TOTP code succeeds
    const validTotp = generateTotpCode(rootSecret);
    const successTotpRes = await request
      .post('/api/auth/login')
      .send({ username: 'root_elena', password, totp_code: validTotp });

    assert.equal(successTotpRes.status, 200);
    assert.ok(successTotpRes.body.token);
    assert.equal(successTotpRes.body.user.role, 'root');

    // Login with valid single-use recovery code succeeds
    const codeToUse = rawCodes[0];
    const recoveryLoginRes = await request
      .post('/api/auth/login')
      .send({ username: 'root_elena', password, recovery_code: codeToUse });

    assert.equal(recoveryLoginRes.status, 200);
    assert.ok(recoveryLoginRes.body.token);

    // Re-using the same recovery code immediately fails
    const reuseRes = await request
      .post('/api/auth/login')
      .send({ username: 'root_elena', password, recovery_code: codeToUse });

    assert.equal(reuseRes.status, 401);
    assert.equal(repos.recoveryCodes.getRemainingCount('root_auth_01'), 7);
  });

  test('7. Self-Service Phone Migration Flow (/api/auth/mfa/transfer)', async () => {
    const password = 'AdminPasswordPhone2026!';
    const passwordHash = await hashPassword(password);
    const oldSecret = generateTotpSecret();

    repos.users.createUser({
      id: 'mod_transfer_01',
      username: 'mod_transfer_user',
      password_hash: passwordHash,
      role: 'mod',
      totp_secret: encryptTotpSecret(oldSecret),
      totp_enabled: 1
    });

    const sessionToken = signToken({
      userId: 'mod_transfer_01',
      username: 'mod_transfer_user',
      role: 'mod'
    });

    // Step 1: Transfer Init
    const initRes = await request
      .post('/api/auth/mfa/transfer/init')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ password });

    assert.equal(initRes.status, 200);
    assert.ok(initRes.body.newSecret);
    assert.ok(initRes.body.qrCodeDataUrl);
    const newSecret = initRes.body.newSecret;

    // Wrong password during init fails
    const badInitRes = await request
      .post('/api/auth/mfa/transfer/init')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ password: 'WrongPassword!' });
    assert.equal(badInitRes.status, 401);

    // Step 2: Transfer Confirm
    const newPhoneCode = generateTotpCode(newSecret);
    const confirmRes = await request
      .post('/api/auth/mfa/transfer/confirm')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({
        password,
        newSecret,
        newTotpCode: newPhoneCode
      });

    assert.equal(confirmRes.status, 200);
    assert.equal(confirmRes.body.success, true);
    assert.equal(confirmRes.body.recoveryCodes.length, 8);

    // Verify DB now holds the new secret and rejects old phone codes
    const updatedUser = repos.users.findById('mod_transfer_01');
    const decryptedStoredSecret = decryptTotpSecret(updatedUser.totp_secret);
    assert.equal(decryptedStoredSecret, newSecret);

    const oldCode = generateTotpCode(oldSecret);
    assert.equal(verifyTotpCode(decryptedStoredSecret, oldCode), false, 'Old phone code must be rejected');

    const freshNewCode = generateTotpCode(newSecret);
    assert.equal(verifyTotpCode(decryptedStoredSecret, freshNewCode), true, 'New phone code must be accepted');

    // 8 fresh recovery codes are active
    assert.equal(repos.recoveryCodes.getRemainingCount('mod_transfer_01'), 8);
  });

  test('8. Structural Role Separation & Password Reset Permissions', async () => {
    const clerkHash = await hashPassword('ClerkPass123!');
    const modHash = await hashPassword('ModPass123!');
    const rootHash = await hashPassword('RootPass123!');

    repos.users.createUser({ id: 'clk_rbac_01', username: 'clk_rbac', password_hash: clerkHash, role: 'clerk' });
    repos.users.createUser({ id: 'mod_rbac_01', username: 'mod_rbac', password_hash: modHash, role: 'mod' });
    repos.users.createUser({ id: 'root_rbac_01', username: 'root_rbac', password_hash: rootHash, role: 'root' });

    const modToken = signToken({ userId: 'mod_rbac_01', username: 'mod_rbac', role: 'mod' });
    const rootToken = signToken({ userId: 'root_rbac_01', username: 'root_rbac', role: 'root' });
    const clerkToken = signToken({ userId: 'clk_rbac_01', username: 'clk_rbac', role: 'clerk' });

    // Mod resets Clerk password -> ALLOWED (200)
    const modResetClerk = await request
      .post('/api/auth/reset-password')
      .set('Authorization', `Bearer ${modToken}`)
      .send({ targetUserId: 'clk_rbac_01', newPassword: 'NewClerkPassword2026!' });
    assert.equal(modResetClerk.status, 200);

    // Mod attempts to reset Root password -> FORBIDDEN (403)
    const modResetRoot = await request
      .post('/api/auth/reset-password')
      .set('Authorization', `Bearer ${modToken}`)
      .send({ targetUserId: 'root_rbac_01', newPassword: 'HackedPassword2026!' });
    assert.equal(modResetRoot.status, 403);

    // Clerk attempts to reset Mod password -> FORBIDDEN (403)
    const clerkResetMod = await request
      .post('/api/auth/reset-password')
      .set('Authorization', `Bearer ${clerkToken}`)
      .send({ targetUserId: 'mod_rbac_01', newPassword: 'HackedPassword2026!' });
    assert.equal(clerkResetMod.status, 403);

    // Root resets Mod password with MFA reset -> ALLOWED (200)
    const rootResetMod = await request
      .post('/api/auth/reset-password')
      .set('Authorization', `Bearer ${rootToken}`)
      .send({ targetUserId: 'mod_rbac_01', newPassword: 'NewModPassword2026!', resetMfa: true });
    assert.equal(rootResetMod.status, 200);

    const updatedMod = repos.users.findById('mod_rbac_01');
    assert.equal(updatedMod.totp_enabled, 0, 'Root MFA reset flag must reset totp_enabled to 0');
  });
});
