// Master End-to-End Integration Suite for ScatterID Ops & Access
// Verifies all Scenario B flows, Static Test Harness, MFA Phone Migration, and Disaster Recovery
// Document ID: DEV-ARCH-08 / Master Blueprint: start.md

process.env.JWT_SECRET = process.env.JWT_SECRET || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import supertest from 'supertest';
import crypto from 'node:crypto';

import { initDb, migrateUp } from '../db/migrations/runner.js';
import { createRepositories } from '../db/models/index.js';
import { hashPassword } from '../src/auth/passwords.js';
import {
  generateTotpSecret,
  generateTotpCode,
  encryptTotpSecret,
  decryptTotpSecret
} from '../src/auth/totp.js';
import { generateRecoveryCodesBatch, hashRecoveryCode } from '../src/auth/recoveryCodes.js';
import { createApp } from '../src/server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_DB_PATH = path.resolve(__dirname, 'test_e2e.db');

function cleanupTestDb() {
  for (const suffix of ['', '-wal', '-shm']) {
    const file = `${TEST_DB_PATH}${suffix}`;
    if (fs.existsSync(file)) {
      try { fs.unlinkSync(file); } catch (e) {}
    }
  }
}

describe('Phase 7: Master End-to-End Integration Suite', () => {
  let db;
  let repos;
  let request;

  let clerkUser;
  let modUser;
  let rootUser;

  let modSecret;
  let rootSecret;

  before(async () => {
    cleanupTestDb();
    const initResult = initDb(TEST_DB_PATH);
    db = initResult.db;
    migrateUp(db);
    repos = createRepositories(db);

    const appObj = createApp({ db, repos });
    request = supertest(appObj.app);

    const pHash = await hashPassword('MasterSecretPass2026!');

    // 1. Clerk user (password only)
    clerkUser = repos.users.createUser({
      id: 'clk_e2e_01',
      username: 'clerk_e2e',
      password_hash: pHash,
      role: 'clerk',
      station_id: 'counter-terminal-e2e'
    });

    // 2. Mod user (MFA mandatory)
    modSecret = generateTotpSecret();
    modUser = repos.users.createUser({
      id: 'mod_e2e_01',
      username: 'mod_e2e',
      password_hash: pHash,
      role: 'mod',
      totp_secret: encryptTotpSecret(modSecret),
      totp_enabled: 1
    });

    // 3. Root user (MFA mandatory)
    rootSecret = generateTotpSecret();
    rootUser = repos.users.createUser({
      id: 'root_e2e_01',
      username: 'root_e2e',
      password_hash: pHash,
      role: 'root',
      totp_secret: encryptTotpSecret(rootSecret),
      totp_enabled: 1
    });

    const rootCodes = generateRecoveryCodesBatch(8);
    repos.recoveryCodes.saveCodesForUser(rootUser.id, rootCodes.map(hashRecoveryCode));
  });

  after(() => {
    if (db) {
      try { db.close(); } catch (e) {}
    }
    cleanupTestDb();
  });

  test('1. Production Operations Console & Authentication Static Serving', async () => {
    const resDash = await request.get('/dashboard.html');
    assert.equal(resDash.status, 200);
    assert.match(resDash.text, /ScatterID Operations Console/);
    assert.match(resDash.text, /Moderation Queue/);

    const resLogin = await request.get('/login.html');
    assert.equal(resLogin.status, 200);
    assert.match(resLogin.text, /Staff Authentication/);

    const resRoot = await request.get('/');
    assert.equal(resRoot.status, 302);
    assert.equal(resRoot.headers.location, '/index.html');

    const resIndex = await request.get('/index.html');
    assert.equal(resIndex.status, 200);
    assert.match(resIndex.text, /Redirecting to ScatterID Operations Console/);
  });

  test('2. Scenario B Flow 1: Hard-Channel Issuance Auto-Execution End-to-End', async () => {
    // Step A: Clerk authenticates
    const clerkLogin = await request
      .post('/api/auth/login')
      .send({ username: 'clerk_e2e', password: 'MasterSecretPass2026!' });
    assert.equal(clerkLogin.status, 200);
    const clerkToken = clerkLogin.body.token;

    // Step B: Clerk submits Hard-Channel Issuance request with 4 verified checkpoints
    const intakeRes = await request
      .post('/api/requests/issue')
      .set('Authorization', `Bearer ${clerkToken}`)
      .set('X-Forwarded-For', '10.20.0.99')
      .send({
        submission_channel: 'hard',
        claimant_data: {
          fullName: 'Ada Lovelace',
          nationalId: 'NAT-GB-181512'
        },
        inspection_checklist_verified: true
      });
    assert.equal(intakeRes.status, 201);
    const reqId = intakeRes.body.requestId;

    // Step C: Moderator authenticates with Password + TOTP
    const modCode = generateTotpCode(modSecret);
    const modLogin = await request
      .post('/api/auth/login')
      .send({ username: 'mod_e2e', password: 'MasterSecretPass2026!', totp_code: modCode });
    assert.equal(modLogin.status, 200);
    const modToken = modLogin.body.token;

    // Step D: Mod inspects pending requests
    const pendingList = await request
      .get('/api/requests/pending')
      .set('Authorization', `Bearer ${modToken}`);
    assert.ok(pendingList.body.requests.some(r => r.id === reqId));

    // Step E: Mod explicitly approves -> Policy AUTO-EXECUTES on Fabric ledger
    const decideRes = await request
      .post(`/api/requests/${reqId}/decide`)
      .set('Authorization', `Bearer ${modToken}`)
      .send({ action: 'APPROVE', reason: 'Physical security foil and UV verified' });

    assert.equal(decideRes.status, 200);
    assert.equal(decideRes.body.status, 'EXECUTED');
    assert.equal(decideRes.body.executed, true);
    assert.ok(decideRes.body.execution_tx_id);

    // Step F: Clerk tracks request status
    const trackRes = await request
      .get(`/api/requests/track/${reqId}`)
      .set('Authorization', `Bearer ${clerkToken}`);
    assert.equal(trackRes.status, 200);
    assert.equal(trackRes.body.status, 'EXECUTED');

    // Step G: Check Immutable Audit Log for complete dual-attribution stamp
    const auditEntries = repos.auditLog.getByRequestId(reqId);
    assert.ok(auditEntries.some(a => a.action === 'CLERK_REQUEST_SUBMITTED' && a.actor_id === 'clk_e2e_01'));
    assert.ok(auditEntries.some(a => a.action === 'MOD_APPROVED_AUTO_EXECUTED' && a.actor_id === 'mod_e2e_01'));
  });

  test('3. Scenario B Flow 2: Soft-Channel Issuance Gated to Root End-to-End', async () => {
    // Clerk session
    const clerkLogin = await request
      .post('/api/auth/login')
      .send({ username: 'clerk_e2e', password: 'MasterSecretPass2026!' });
    const clerkToken = clerkLogin.body.token;

    // Clerk submits Soft-Channel request with digital scan SHA-256
    const sampleSha = crypto.createHash('sha256').update('Document Scan Test').digest('hex');
    const intakeRes = await request
      .post('/api/requests/issue')
      .set('Authorization', `Bearer ${clerkToken}`)
      .send({
        submission_channel: 'soft',
        claimant_data: { fullName: 'Charles Babbage', nationalId: 'NAT-GB-179112' },
        evidence_sha256: sampleSha
      });
    const reqId = intakeRes.body.requestId;

    // Mod session
    const modCode = generateTotpCode(modSecret);
    const modLogin = await request
      .post('/api/auth/login')
      .send({ username: 'mod_e2e', password: 'MasterSecretPass2026!', totp_code: modCode });
    const modToken = modLogin.body.token;

    // Mod approves Soft Issue -> Escalates to AWAITING_ROOT_ACCEPT
    const modDecide = await request
      .post(`/api/requests/${reqId}/decide`)
      .set('Authorization', `Bearer ${modToken}`)
      .send({ action: 'APPROVE', reason: 'Soft scan legibility verified' });

    assert.equal(modDecide.body.status, 'AWAITING_ROOT_ACCEPT');
    assert.equal(modDecide.body.executed, false);

    // Root authenticates with Password + TOTP
    const rootCode = generateTotpCode(rootSecret);
    const rootLogin = await request
      .post('/api/auth/login')
      .send({ username: 'root_e2e', password: 'MasterSecretPass2026!', totp_code: rootCode });
    assert.equal(rootLogin.status, 200);
    const rootToken = rootLogin.body.token;

    // Root inspects Awaiting Root queue
    const rootQueue = await request
      .get('/api/requests/queue/awaiting-root')
      .set('Authorization', `Bearer ${rootToken}`);
    assert.ok(rootQueue.body.requests.some(r => r.id === reqId));

    // Root executes request
    const rootExec = await request
      .post(`/api/requests/${reqId}/root-execute`)
      .set('Authorization', `Bearer ${rootToken}`)
      .send({ action: 'ACCEPT' });

    assert.equal(rootExec.status, 200);
    assert.equal(rootExec.body.status, 'EXECUTED');
    assert.equal(rootExec.body.executed, true);
    assert.ok(rootExec.body.execution_tx_id);
  });

  test('4. Scenario B Flow 3: Hard-Channel Revocation Strictly Gated to Root', async () => {
    // Clerk session
    const clerkLogin = await request
      .post('/api/auth/login')
      .send({ username: 'clerk_e2e', password: 'MasterSecretPass2026!' });
    const clerkToken = clerkLogin.body.token;

    // Revocation intake
    const intakeRes = await request
      .post('/api/requests/revoke')
      .set('Authorization', `Bearer ${clerkToken}`)
      .send({
        credential_id: 'cred_target_revocation_e2e',
        reason: 'Physical badge reported stolen',
        submission_channel: 'hard'
      });
    const reqId = intakeRes.body.requestId;

    // Mod session
    const modCode = generateTotpCode(modSecret);
    const modLogin = await request
      .post('/api/auth/login')
      .send({ username: 'mod_e2e', password: 'MasterSecretPass2026!', totp_code: modCode });
    const modToken = modLogin.body.token;

    // Mod approves -> MUST strictly route to Root (never auto-executes)
    const modDecide = await request
      .post(`/api/requests/${reqId}/decide`)
      .set('Authorization', `Bearer ${modToken}`)
      .send({ action: 'APPROVE', reason: 'Badge loss verified' });

    assert.equal(modDecide.body.status, 'AWAITING_ROOT_ACCEPT');
    assert.equal(modDecide.body.executed, false);

    // Root session
    const rootCode = generateTotpCode(rootSecret);
    const rootLogin = await request
      .post('/api/auth/login')
      .send({ username: 'root_e2e', password: 'MasterSecretPass2026!', totp_code: rootCode });
    const rootToken = rootLogin.body.token;

    // Root executes revocation
    const rootExec = await request
      .post(`/api/requests/${reqId}/root-execute`)
      .set('Authorization', `Bearer ${rootToken}`)
      .send({ action: 'ACCEPT' });

    assert.equal(rootExec.body.status, 'EXECUTED');
    assert.ok(rootExec.body.execution_tx_id.startsWith('tx_fabric_revoke_'));
  });

  test('5. Self-Service Phone Migration End-to-End', async () => {
    // Mod logs in
    const modCode = generateTotpCode(modSecret);
    const modLogin = await request
      .post('/api/auth/login')
      .send({ username: 'mod_e2e', password: 'MasterSecretPass2026!', totp_code: modCode });
    const modToken = modLogin.body.token;

    // Step 1: Initiate Transfer
    const initRes = await request
      .post('/api/auth/mfa/transfer/init')
      .set('Authorization', `Bearer ${modToken}`)
      .send({ password: 'MasterSecretPass2026!' });
    assert.equal(initRes.status, 200);
    const newPhoneSecret = initRes.body.newSecret;
    assert.ok(initRes.body.qrCodeDataUrl);

    // Step 2: Confirm with 6-digit code from new phone
    const newPhoneCode = generateTotpCode(newPhoneSecret);
    const confirmRes = await request
      .post('/api/auth/mfa/transfer/confirm')
      .set('Authorization', `Bearer ${modToken}`)
      .send({
        password: 'MasterSecretPass2026!',
        newSecret: newPhoneSecret,
        newTotpCode: newPhoneCode
      });
    assert.equal(confirmRes.status, 200);
    assert.equal(confirmRes.body.recoveryCodes.length, 8);

    // Step 3: Verify old phone is revoked
    const oldCode = generateTotpCode(modSecret);
    const failOldLogin = await request
      .post('/api/auth/login')
      .send({ username: 'mod_e2e', password: 'MasterSecretPass2026!', totp_code: oldCode });
    assert.equal(failOldLogin.status, 401);

    // Step 4: Verify new phone code logs in
    const freshNewCode = generateTotpCode(newPhoneSecret);
    const successNewLogin = await request
      .post('/api/auth/login')
      .send({ username: 'mod_e2e', password: 'MasterSecretPass2026!', totp_code: freshNewCode });
    assert.equal(successNewLogin.status, 200);

    // Update test state
    modSecret = newPhoneSecret;
  });

  test('6. Zero-Downtime Dual-Key Gateway Rotation End-to-End', async () => {
    const rootCode = generateTotpCode(rootSecret);
    const rootLogin = await request
      .post('/api/auth/login')
      .send({ username: 'root_e2e', password: 'MasterSecretPass2026!', totp_code: rootCode });
    const rootToken = rootLogin.body.token;

    // Rotate key 1
    const rot1 = await request
      .post('/api/keys/gateway/rotate')
      .set('Authorization', `Bearer ${rootToken}`)
      .send({ key_name: 'REVOKE_API_KEY', grace_window_hours: 24 });
    const key1 = rot1.body.plaintextKey;

    // Rotate key 2 -> key 1 enters grace window
    const rot2 = await request
      .post('/api/keys/gateway/rotate')
      .set('Authorization', `Bearer ${rootToken}`)
      .send({ key_name: 'REVOKE_API_KEY', grace_window_hours: 24 });
    const key2 = rot2.body.plaintextKey;

    // Both keys validate simultaneously
    const val1 = await request.post('/api/keys/gateway/validate').send({ key_name: 'REVOKE_API_KEY', token: key1 });
    const val2 = await request.post('/api/keys/gateway/validate').send({ key_name: 'REVOKE_API_KEY', token: key2 });
    assert.equal(val1.body.valid, true);
    assert.equal(val1.body.status, 'grace');
    assert.equal(val2.body.valid, true);
    assert.equal(val2.body.status, 'active');
  });

  test('7. Encrypted PQC Envelope Export & Restore End-to-End', async () => {
    const rootCode = generateTotpCode(rootSecret);
    const rootLogin = await request
      .post('/api/auth/login')
      .send({ username: 'root_e2e', password: 'MasterSecretPass2026!', totp_code: rootCode });
    const rootToken = rootLogin.body.token;

    // Export
    const exportRes = await request
      .post('/api/keys/pqc/export')
      .set('Authorization', `Bearer ${rootToken}`)
      .send({ master_passphrase: 'MasterEncryptedKeyPassphrase2026!' });
    assert.equal(exportRes.status, 200);
    const envelope = exportRes.body.envelope;

    // Restore
    const restoreRes = await request
      .post('/api/keys/pqc/restore')
      .set('Authorization', `Bearer ${rootToken}`)
      .send({
        master_passphrase: 'MasterEncryptedKeyPassphrase2026!',
        envelope
      });
    assert.equal(restoreRes.status, 200);
    assert.equal(restoreRes.body.success, true);
  });
});
