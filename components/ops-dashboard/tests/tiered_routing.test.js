// Automated Unit & Integration Tests for Phase 4: Scenario B Tiered Risk Decision & Execution Engine
// Document ID: DEV-ARCH-08 / ADDENDUM-01 / SEC-OPS-06

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import supertest from 'supertest';

import { initDb, migrateUp } from '../db/migrations/runner.js';
import { createRepositories } from '../db/models/index.js';
import { hashPassword } from '../src/auth/passwords.js';
import { signToken } from '../src/auth/tokens.js';
import { createApp } from '../src/server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_DB_PATH = path.resolve(__dirname, 'test_tiered_routing.db');

function cleanupTestDb() {
  for (const suffix of ['', '-wal', '-shm']) {
    const file = `${TEST_DB_PATH}${suffix}`;
    if (fs.existsSync(file)) {
      try { fs.unlinkSync(file); } catch (e) {}
    }
  }
}

describe('Phase 4: Scenario B Tiered Risk Decision & Execution Engine', () => {
  let db;
  let repos;
  let request;
  let clerkToken;
  let modToken;
  let rootToken;

  before(async () => {
    cleanupTestDb();
    const initResult = initDb(TEST_DB_PATH);
    db = initResult.db;
    migrateUp(db);
    repos = createRepositories(db);

    const appObj = createApp({ db, repos });
    request = supertest(appObj.app);

    const pHash = await hashPassword('SecurePass2026!');
    repos.users.createUser({ id: 'clk_tier_01', username: 'clerk_sam', password_hash: pHash, role: 'clerk', station_id: 'counter-01' });
    repos.users.createUser({ id: 'mod_tier_01', username: 'mod_mia', password_hash: pHash, role: 'mod' });
    repos.users.createUser({ id: 'root_tier_01', username: 'root_raj', password_hash: pHash, role: 'root' });

    clerkToken = signToken({ userId: 'clk_tier_01', username: 'clerk_sam', role: 'clerk', stationId: 'counter-01' });
    modToken = signToken({ userId: 'mod_tier_01', username: 'mod_mia', role: 'mod' });
    rootToken = signToken({ userId: 'root_tier_01', username: 'root_raj', role: 'root' });
  });

  after(() => {
    if (db) {
      try { db.close(); } catch (e) {}
    }
    cleanupTestDb();
  });

  test('1. Policy Auto-Execution: Hard-Channel Issue + Mod Approve -> Fabric Ledger Execution', async () => {
    // Step A: Clerk submits Hard-Channel Issue
    const intakeRes = await request
      .post('/api/requests/issue')
      .set('Authorization', `Bearer ${clerkToken}`)
      .send({
        submission_channel: 'hard',
        claimant_data: { fullName: 'Arthur Dent', nationalId: 'NAT-UK-4242' },
        inspection_checklist_verified: true
      });

    assert.equal(intakeRes.status, 201);
    const reqId = intakeRes.body.requestId;

    // Step B: Mod Approves
    const decideRes = await request
      .post(`/api/requests/${reqId}/decide`)
      .set('Authorization', `Bearer ${modToken}`)
      .send({
        action: 'APPROVE',
        reason: 'Physical passport inspected, UV security hologram confirmed'
      });

    assert.equal(decideRes.status, 200);
    assert.equal(decideRes.body.success, true);
    assert.equal(decideRes.body.status, 'EXECUTED');
    assert.equal(decideRes.body.executed, true);
    assert.equal(decideRes.body.routing_tier, 'AUTO_EXECUTED');
    assert.ok(decideRes.body.execution_tx_id.startsWith('tx_fabric_'));

    // Step C: Verify stored state in DB
    const stored = repos.requests.getById(reqId);
    assert.equal(stored.status, 'EXECUTED');
    assert.equal(stored.moderator_action, 'APPROVE');
    assert.equal(stored.moderator_id, 'mod_tier_01');
    assert.equal(stored.execution_tx_id, decideRes.body.execution_tx_id);

    // Step D: Verify Dual Attribution in Audit Log
    const auditLogs = repos.auditLog.getByRequestId(reqId);
    const modLog = auditLogs.find(l => l.action === 'MOD_APPROVED_AUTO_EXECUTED');
    assert.ok(modLog);
    assert.equal(modLog.actor_id, 'mod_tier_01');
    const details = JSON.parse(modLog.details);
    assert.equal(details.policy, 'SCENARIO_B_HARD_CHANNEL_AUTO_EXECUTE');
  });

  test('2. Root Gating: Soft-Channel Issue + Mod Approve -> Escalates to Awaiting Root Queue', async () => {
    // Step A: Clerk submits Soft-Channel Issue
    const intakeRes = await request
      .post('/api/requests/issue')
      .set('Authorization', `Bearer ${clerkToken}`)
      .send({
        submission_channel: 'soft',
        claimant_data: { fullName: 'Ford Prefect', nationalId: 'NAT-DIG-9911' },
        evidence_sha256: 'a'.repeat(64)
      });

    assert.equal(intakeRes.status, 201);
    const reqId = intakeRes.body.requestId;

    // Step B: Mod Approves Soft Issue -> MUST NOT execute; must escalate
    const decideRes = await request
      .post(`/api/requests/${reqId}/decide`)
      .set('Authorization', `Bearer ${modToken}`)
      .send({
        action: 'APPROVE',
        reason: 'Digital scan resolution checked; valid 300DPI PDF'
      });

    assert.equal(decideRes.status, 200);
    assert.equal(decideRes.body.status, 'AWAITING_ROOT_ACCEPT');
    assert.equal(decideRes.body.executed, false);

    const storedAwaiting = repos.requests.getById(reqId);
    assert.equal(storedAwaiting.status, 'AWAITING_ROOT_ACCEPT');
    assert.equal(storedAwaiting.execution_tx_id, null);

    // Step C: Mod attempts to execute Root endpoint -> STRICTLY FORBIDDEN (403)
    const modExecuteFail = await request
      .post(`/api/requests/${reqId}/root-execute`)
      .set('Authorization', `Bearer ${modToken}`)
      .send({ action: 'ACCEPT' });
    assert.equal(modExecuteFail.status, 403);

    // Step D: Root views Awaiting Accept Queue (FR-12)
    const rootQueueRes = await request
      .get('/api/requests/queue/awaiting-root')
      .set('Authorization', `Bearer ${rootToken}`);
    assert.equal(rootQueueRes.status, 200);
    assert.ok(rootQueueRes.body.requests.some(r => r.id === reqId));

    // Step E: Root Executes Request (FR-14)
    const rootExecRes = await request
      .post(`/api/requests/${reqId}/root-execute`)
      .set('Authorization', `Bearer ${rootToken}`)
      .send({ action: 'ACCEPT' });

    assert.equal(rootExecRes.status, 200);
    assert.equal(rootExecRes.body.status, 'EXECUTED');
    assert.equal(rootExecRes.body.executed, true);
    assert.ok(rootExecRes.body.execution_tx_id.startsWith('tx_fabric_'));

    const storedExecuted = repos.requests.getById(reqId);
    assert.equal(storedExecuted.status, 'EXECUTED');
    assert.equal(storedExecuted.root_id, 'root_tier_01');
  });

  test('3. Strict Root Invariant: Revocations NEVER Auto-Execute Regardless of Channel', async () => {
    // Step A: Hard-Channel Revocation request
    const intakeRes = await request
      .post('/api/requests/revoke')
      .set('Authorization', `Bearer ${clerkToken}`)
      .send({
        credential_id: 'cred_hard_revoke_123',
        reason: 'Physical card lost',
        submission_channel: 'hard'
      });

    const reqId = intakeRes.body.requestId;

    // Step B: Mod Approves -> MUST strictly escalate to Root (NEVER auto-executes)
    const decideRes = await request
      .post(`/api/requests/${reqId}/decide`)
      .set('Authorization', `Bearer ${modToken}`)
      .send({
        action: 'APPROVE',
        reason: 'Card loss confirmed'
      });

    assert.equal(decideRes.status, 200);
    assert.equal(decideRes.body.status, 'AWAITING_ROOT_ACCEPT');
    assert.equal(decideRes.body.executed, false);

    const stored = repos.requests.getById(reqId);
    assert.equal(stored.status, 'AWAITING_ROOT_ACCEPT');
    assert.equal(stored.execution_tx_id, null);

    // Step C: Root Executes Revocation
    const rootExecRes = await request
      .post(`/api/requests/${reqId}/root-execute`)
      .set('Authorization', `Bearer ${rootToken}`)
      .send({ action: 'ACCEPT' });

    assert.equal(rootExecRes.status, 200);
    assert.equal(rootExecRes.body.status, 'EXECUTED');
    assert.ok(rootExecRes.body.execution_tx_id.startsWith('tx_fabric_revoke_'));
  });

  test('4. Moderator Flagging with Mandatory Reason -> FLAGGED Queue (FR-13)', async () => {
    // Intake
    const intakeRes = await request
      .post('/api/requests/issue')
      .set('Authorization', `Bearer ${clerkToken}`)
      .send({
        submission_channel: 'hard',
        claimant_data: { fullName: 'Suspect User' },
        inspection_checklist_verified: true
      });
    const reqId = intakeRes.body.requestId;

    // Mod flags without reason -> REJECTED (400)
    const failFlagRes = await request
      .post(`/api/requests/${reqId}/decide`)
      .set('Authorization', `Bearer ${modToken}`)
      .send({ action: 'FLAG' });
    assert.equal(failFlagRes.status, 400);
    assert.equal(failFlagRes.body.error, 'REASON_REQUIRED');

    // Mod flags with valid reason
    const flagRes = await request
      .post(`/api/requests/${reqId}/decide`)
      .set('Authorization', `Bearer ${modToken}`)
      .send({
        action: 'FLAG',
        reason: 'FRAUD_SUSPECTED: Polycarbonate substrate thickness is anomalous'
      });
    assert.equal(flagRes.status, 200);
    assert.equal(flagRes.body.status, 'FLAGGED');

    // Appears in Root's Flagged queue
    const flaggedQueueRes = await request
      .get('/api/requests/queue/flagged')
      .set('Authorization', `Bearer ${rootToken}`);
    assert.equal(flaggedQueueRes.status, 200);
    assert.ok(flaggedQueueRes.body.requests.some(r => r.id === reqId));

    // Root Rejects from Flagged queue
    const rootRejectRes = await request
      .post(`/api/requests/${reqId}/root-execute`)
      .set('Authorization', `Bearer ${rootToken}`)
      .send({
        action: 'REJECT',
        reason: 'Confirmed forensic failure at counter'
      });
    assert.equal(rootRejectRes.status, 200);
    assert.equal(rootRejectRes.body.status, 'REJECTED');
    assert.equal(rootRejectRes.body.executed, false);
  });

  test('5. Moderator Direct Rejection Closes Request Immediately', async () => {
    const intakeRes = await request
      .post('/api/requests/issue')
      .set('Authorization', `Bearer ${clerkToken}`)
      .send({
        submission_channel: 'soft',
        claimant_data: { fullName: 'Illegible User' },
        evidence_sha256: 'b'.repeat(64)
      });
    const reqId = intakeRes.body.requestId;

    const rejectRes = await request
      .post(`/api/requests/${reqId}/decide`)
      .set('Authorization', `Bearer ${modToken}`)
      .send({
        action: 'REJECT',
        reason: 'Uploaded scan is blurry and unreadable'
      });

    assert.equal(rejectRes.status, 200);
    assert.equal(rejectRes.body.status, 'REJECTED');
    assert.equal(rejectRes.body.executed, false);

    // Neither Root queue has it
    const awaitingRes = await request
      .get('/api/requests/queue/awaiting-root')
      .set('Authorization', `Bearer ${rootToken}`);
    assert.ok(!awaitingRes.body.requests.some(r => r.id === reqId));

    const flaggedRes = await request
      .get('/api/requests/queue/flagged')
      .set('Authorization', `Bearer ${rootToken}`);
    assert.ok(!flaggedRes.body.requests.some(r => r.id === reqId));
  });

  test('6. Structural Privilege Separation Invariants', async () => {
    // Clerk cannot decide requests
    const clerkDecide = await request
      .post('/api/requests/req_test/decide')
      .set('Authorization', `Bearer ${clerkToken}`)
      .send({ action: 'APPROVE' });
    assert.equal(clerkDecide.status, 403);

    // Mod cannot view Root's queues
    const modAwaiting = await request
      .get('/api/requests/queue/awaiting-root')
      .set('Authorization', `Bearer ${modToken}`);
    assert.equal(modAwaiting.status, 403);

    const modFlagged = await request
      .get('/api/requests/queue/flagged')
      .set('Authorization', `Bearer ${modToken}`);
    assert.equal(modFlagged.status, 403);
  });
});
