// Unit & Integration Test Suite for Ops Dashboard Token & Session Revocation
// Audit Report Finding: 🔴 Critical — No token/session revocation exists anywhere
// Validates token_version embedding, password-reset revocation, MFA transfer revocation,
// explicit session invalidation, and user isolation.

process.env.JWT_SECRET = process.env.JWT_SECRET || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import supertest from 'supertest';

import { initDb, migrateUp } from '../db/migrations/runner.js';
import { createRepositories } from '../db/models/index.js';
import { hashPassword } from '../src/auth/passwords.js';
import {
  generateTotpSecret,
  generateTotpCode,
  encryptTotpSecret
} from '../src/auth/totp.js';
import { signToken, verifyToken } from '../src/auth/tokens.js';
import { createApp } from '../src/server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_DB_PATH = path.resolve(__dirname, 'test_revocation.db');

function cleanupTestDb() {
  for (const suffix of ['', '-wal', '-shm']) {
    const file = `${TEST_DB_PATH}${suffix}`;
    if (fs.existsSync(file)) {
      try { fs.unlinkSync(file); } catch (e) {}
    }
  }
}

describe('🔴 Critical Finding: Token & Session Revocation Engine', () => {
  let db;
  let repos;
  let request;

  let clerkUser;
  let modUser;
  let rootUser;
  let modSecret;

  before(async () => {
    cleanupTestDb();
    const initResult = initDb(TEST_DB_PATH);
    db = initResult.db;
    migrateUp(db);
    repos = createRepositories(db);

    const appObj = createApp({ db, repos });
    request = supertest(appObj.app);

    const pHash = await hashPassword('InitialSecretPass2026!');
    clerkUser = repos.users.createUser({
      id: 'usr_clk_rev_01',
      username: 'clerk_rev',
      password_hash: pHash,
      role: 'clerk',
      station_id: 'station_desk_01'
    });

    modSecret = generateTotpSecret();
    modUser = repos.users.createUser({
      id: 'usr_mod_rev_01',
      username: 'mod_rev',
      password_hash: pHash,
      role: 'mod',
      totp_secret: encryptTotpSecret(modSecret),
      totp_enabled: 1
    });

    rootUser = repos.users.createUser({
      id: 'usr_root_rev_01',
      username: 'root_rev',
      password_hash: pHash,
      role: 'root',
      totp_secret: encryptTotpSecret(generateTotpSecret()),
      totp_enabled: 1
    });
  });

  after(() => {
    if (db) {
      try { db.close(); } catch (e) {}
    }
    cleanupTestDb();
  });

  test('1. signToken automatically embeds user token_version in JWT payload', () => {
    const user = repos.users.findById('usr_clk_rev_01');
    assert.equal(user.token_version, 1, 'Initial user token_version must be 1');

    const token = signToken({
      userId: user.id,
      username: user.username,
      role: user.role,
      token_version: user.token_version
    });

    const decoded = verifyToken(token);
    assert.equal(decoded.userId, 'usr_clk_rev_01');
    assert.equal(decoded.token_version, 1, 'Decoded payload must contain token_version 1');
  });

  test('2. Valid session token authenticates successfully on protected route', async () => {
    const user = repos.users.findById('usr_clk_rev_01');
    const token = signToken({
      userId: user.id,
      username: user.username,
      role: user.role,
      token_version: user.token_version
    });

    const res = await request
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.user.username, 'clerk_rev');
    assert.equal(res.body.user.token_version, 1);
  });

  test('3. Password reset instantly invalidates previous session token (Self-Reset)', async () => {
    const user = repos.users.findById('usr_clk_rev_01');
    const oldToken = signToken({
      userId: user.id,
      username: user.username,
      role: user.role,
      token_version: user.token_version
    });

    // Reset own password
    const resetRes = await request
      .post('/api/auth/reset-password')
      .set('Authorization', `Bearer ${oldToken}`)
      .send({
        currentPassword: 'InitialSecretPass2026!',
        newPassword: 'BrandNewClerkPass2026!'
      });

    assert.equal(resetRes.status, 200);
    assert.ok(resetRes.body.token, 'Self-reset must return a fresh active token with new version');

    // Attempting to use the OLD token must immediately fail with 401 REVOKED_TOKEN
    const postResetWithOldToken = await request
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${oldToken}`);

    assert.equal(postResetWithOldToken.status, 401);
    assert.equal(postResetWithOldToken.body.error, 'REVOKED_TOKEN');

    // The newly issued token must succeed
    const postResetWithNewToken = await request
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${resetRes.body.token}`);

    assert.equal(postResetWithNewToken.status, 200);
    assert.equal(postResetWithNewToken.body.user.token_version, 2);
  });

  test('4. Administrative password reset invalidates all subordinate active tokens', async () => {
    const clerk = repos.users.findById('usr_clk_rev_01');
    const mod = repos.users.findById('usr_mod_rev_01');

    const clerkActiveToken = signToken({
      userId: clerk.id,
      username: clerk.username,
      role: clerk.role,
      token_version: clerk.token_version
    });

    const modActiveToken = signToken({
      userId: mod.id,
      username: mod.username,
      role: mod.role,
      token_version: mod.token_version
    });

    // Verify clerk active token works initially
    const preCheck = await request
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${clerkActiveToken}`);
    assert.equal(preCheck.status, 200);

    // Mod resets Clerk password
    const modReset = await request
      .post('/api/auth/reset-password')
      .set('Authorization', `Bearer ${modActiveToken}`)
      .send({
        targetUserId: clerk.id,
        newPassword: 'AdminAssignedPass2026!'
      });
    assert.equal(modReset.status, 200);

    // Clerk token is now immediately REVOKED
    const postCheckClerk = await request
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${clerkActiveToken}`);
    assert.equal(postCheckClerk.status, 401);
    assert.equal(postCheckClerk.body.error, 'REVOKED_TOKEN');

    // Mod token is NOT affected (remains valid)
    const modSelfCheck = await request
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${modActiveToken}`);
    assert.equal(modSelfCheck.status, 200);
  });

  test('5. MFA device transfer instantly revokes old device session token', async () => {
    const mod = repos.users.findById('usr_mod_rev_01');
    const oldDeviceToken = signToken({
      userId: mod.id,
      username: mod.username,
      role: mod.role,
      token_version: mod.token_version
    });

    // Step 1: Initialize phone migration
    const initRes = await request
      .post('/api/auth/mfa/transfer/init')
      .set('Authorization', `Bearer ${oldDeviceToken}`)
      .send({ password: 'InitialSecretPass2026!' });
    assert.equal(initRes.status, 200);

    const newSecret = initRes.body.newSecret;
    const newTotpCode = generateTotpCode(newSecret);

    // Step 2: Confirm new phone device
    const confirmRes = await request
      .post('/api/auth/mfa/transfer/confirm')
      .set('Authorization', `Bearer ${oldDeviceToken}`)
      .send({
        password: 'InitialSecretPass2026!',
        newSecret,
        newTotpCode
      });
    assert.equal(confirmRes.status, 200);
    assert.ok(confirmRes.body.token, 'Device transfer must return fresh session token');

    // The old device token must now be rejected as REVOKED
    const oldTokenCheck = await request
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${oldDeviceToken}`);
    assert.equal(oldTokenCheck.status, 401);
    assert.equal(oldTokenCheck.body.error, 'REVOKED_TOKEN');

    // The new device token is fully functional
    const newTokenCheck = await request
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${confirmRes.body.token}`);
    assert.equal(newTokenCheck.status, 200);
  });

  test('6. Explicit session revocation (POST /api/auth/revoke-sessions)', async () => {
    const root = repos.users.findById('usr_root_rev_01');
    const rootToken = signToken({
      userId: root.id,
      username: root.username,
      role: root.role,
      token_version: root.token_version
    });

    // Root revokes own sessions
    const revokeRes = await request
      .post('/api/auth/revoke-sessions')
      .set('Authorization', `Bearer ${rootToken}`)
      .send({});
    assert.equal(revokeRes.status, 200);
    assert.equal(revokeRes.body.success, true);

    // Stolen / existing token is now revoked
    const checkRevoked = await request
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${rootToken}`);
    assert.equal(checkRevoked.status, 401);
    assert.equal(checkRevoked.body.error, 'REVOKED_TOKEN');
  });

  test('7. Explicit logout (POST /api/auth/logout)', async () => {
    const root = repos.users.findById('usr_root_rev_01');
    const freshRootToken = signToken({
      userId: root.id,
      username: root.username,
      role: root.role,
      token_version: root.token_version
    });

    // Verify token works
    const preCheck = await request
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${freshRootToken}`);
    assert.equal(preCheck.status, 200);

    // Call /api/auth/logout
    const logoutRes = await request
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${freshRootToken}`)
      .send({});
    assert.equal(logoutRes.status, 200);
    assert.equal(logoutRes.body.success, true);

    // Active token cannot be re-used after logout
    const postLogout = await request
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${freshRootToken}`);
    assert.equal(postLogout.status, 401);
    assert.equal(postLogout.body.error, 'REVOKED_TOKEN');
  });

  test('8. Missing or deleted user returns USER_NOT_FOUND (401)', async () => {
    const ghostToken = signToken({
      userId: 'usr_non_existent_id_9999',
      username: 'ghost_user',
      role: 'clerk',
      token_version: 1
    });

    const res = await request
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${ghostToken}`);
    assert.equal(res.status, 401);
    assert.equal(res.body.error, 'USER_NOT_FOUND');
  });
});
