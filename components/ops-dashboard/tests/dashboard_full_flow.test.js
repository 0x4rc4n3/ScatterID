// Exhaustive Full-Flow Test Suite for ScatterID Operations Console & RBAC Hierarchy
// Document ID: DEV-TEST-DASHBOARD-01 / ISSUE-104
// Validates Role Hierarchy, Managerial Queues, Rejection/Flagging, Cryptographic Lifecycle, & Audit

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
import { resetPolicyToDefault } from '../src/policy/routingPolicy.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_DB_PATH = path.resolve(__dirname, 'test_dashboard_full_flow.db');

function cleanupTestDb() {
  for (const suffix of ['', '-wal', '-shm']) {
    const file = `${TEST_DB_PATH}${suffix}`;
    if (fs.existsSync(file)) {
      try { fs.unlinkSync(file); } catch (e) {}
    }
  }
}

describe('ISSUE-104: Ops Console Full-Flow RBAC, Managerial & Cryptographic Suite', () => {
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

    const pHash = await hashPassword('MasterSecretPass2026!');
    repos.users.createUser({ id: 'usr_clk_full', username: 'clerk_dan', password_hash: pHash, role: 'clerk', station_id: 'counter-full' });
    repos.users.createUser({ id: 'usr_mod_full', username: 'mod_rachel', password_hash: pHash, role: 'mod' });
    repos.users.createUser({ id: 'usr_root_full', username: 'root_victor', password_hash: pHash, role: 'root' });

    clerkToken = signToken({ userId: 'usr_clk_full', username: 'clerk_dan', role: 'clerk', stationId: 'counter-full' });
    modToken = signToken({ userId: 'usr_mod_full', username: 'mod_rachel', role: 'mod' });
    rootToken = signToken({ userId: 'usr_root_full', username: 'root_victor', role: 'root' });

    // Pre-stage an active key and a pre-staged key in the pool
    repos.pqcKeys.addKeyToPool({
      key_id: 'pqc-mldsa87-flow-active-v1',
      algorithm: 'ML-DSA-87',
      public_key_hex: '0102030405060708'.repeat(4),
      public_key_id_sha3: 'sha3_flow_v1',
      status: 'active',
      sequence_number: 1
    });

    repos.pqcKeys.addKeyToPool({
      key_id: 'pqc-mldsa87-flow-staged-v2',
      algorithm: 'ML-DSA-87',
      public_key_hex: '090a0b0c0d0e0f10'.repeat(4),
      public_key_id_sha3: 'sha3_flow_v2',
      status: 'pre_staged',
      sequence_number: 2
    });
  });

  after(() => {
    if (db) {
      try { db.close(); } catch (e) {}
    }
    cleanupTestDb();
    resetPolicyToDefault();
  });

  // =========================================================================
  // SUITE 1: ROLE-BASED ACCESS CONTROL (RBAC) & PRIVILEGE MATRIX
  // =========================================================================
  describe('1. Role-Based Access Control (RBAC) & Privilege Matrix', () => {
    test('1.1 Anonymous request to protected endpoints returns 401 Unauthorized', async () => {
      const endpoints = [
        ['GET', '/api/requests/queue/pending'],
        ['GET', '/api/requests/queue/awaiting-root'],
        ['GET', '/api/requests/queue/flagged'],
        ['GET', '/api/requests/audit-log'],
        ['GET', '/api/keys/pqc/pool'],
        ['POST', '/api/requests/reconcile']
      ];

      for (const [method, url] of endpoints) {
        const res = method === 'GET'
          ? await request.get(url)
          : await request.post(url);
        assert.equal(res.status, 401, `Expected 401 for anonymous ${method} ${url}`);
      }
    });

    test('1.2 Clerk CANNOT access Moderator or Root endpoints (403 Forbidden)', async () => {
      const forbiddenEndpoints = [
        ['GET', '/api/requests/queue/pending'],
        ['GET', '/api/requests/queue/awaiting-root'],
        ['GET', '/api/requests/queue/flagged'],
        ['GET', '/api/requests/audit-log'],
        ['GET', '/api/keys/pqc/pool'],
        ['POST', '/api/requests/reconcile'],
        ['POST', '/api/requests/policy']
      ];

      for (const [method, url] of forbiddenEndpoints) {
        const reqBuilder = method === 'GET' ? request.get(url) : request.post(url);
        const res = await reqBuilder.set('Authorization', `Bearer ${clerkToken}`);
        assert.equal(res.status, 403, `Expected 403 for clerk accessing ${method} ${url}`);
      }
    });

    test('1.3 Moderator CANNOT execute Root-only actions (403 Forbidden)', async () => {
      const rootOnlyEndpoints = [
        ['GET', '/api/requests/queue/awaiting-root'],
        ['POST', '/api/requests/req_dummy/root-execute'],
        ['POST', '/api/requests/reconcile'],
        ['POST', '/api/requests/policy'],
        ['POST', '/api/keys/gateway/rotate'],
        ['POST', '/api/keys/pqc/promote'],
        ['POST', '/api/keys/pqc/export']
      ];

      for (const [method, url] of rootOnlyEndpoints) {
        const reqBuilder = method === 'GET' ? request.get(url) : request.post(url);
        const res = await reqBuilder.set('Authorization', `Bearer ${modToken}`);
        assert.equal(res.status, 403, `Expected 403 for mod accessing ${method} ${url}`);
      }
    });

    test('1.4 Root has comprehensive access to all managerial queues & operations', async () => {
      const modPending = await request.get('/api/requests/queue/pending').set('Authorization', `Bearer ${rootToken}`);
      assert.equal(modPending.status, 200);

      const awaitingRoot = await request.get('/api/requests/queue/awaiting-root').set('Authorization', `Bearer ${rootToken}`);
      assert.equal(awaitingRoot.status, 200);

      const flagged = await request.get('/api/requests/queue/flagged').set('Authorization', `Bearer ${rootToken}`);
      assert.equal(flagged.status, 200);

      const audit = await request.get('/api/requests/audit-log').set('Authorization', `Bearer ${rootToken}`);
      assert.equal(audit.status, 200);

      const policy = await request.get('/api/requests/policy').set('Authorization', `Bearer ${rootToken}`);
      assert.equal(policy.status, 200);
    });
  });

  // =========================================================================
  // SUITE 2: COMPLETE MANAGERIAL INTAKE-TO-LEDGER EXECUTION FLOWS
  // =========================================================================
  describe('2. Managerial Intake-to-Ledger Execution Flows (Scenario B)', () => {
    test('2.1 Flow A: In-person Hard-Channel Issuance auto-executes upon Moderator Approval', async () => {
      // Step A: Clerk intake
      const intakeRes = await request
        .post('/api/requests/issue')
        .set('Authorization', `Bearer ${clerkToken}`)
        .send({
          submission_channel: 'hard',
          claimant_data: {
            fullName: 'Alexander Wright',
            identifierNumber: 'SCT-HRD-2026-01',
            issuingAuthority: 'ScatterID Central Authority'
          },
          inspection_checklist_verified: true,
          checklist_details: {
            substrate_material_integrity: true,
            optical_security_features: true,
            biometric_face_match: true,
            authority_seal_and_serial: true
          }
        });
      assert.equal(intakeRes.status, 201);
      const reqId = intakeRes.body.requestId;

      // Step B: Appears in Moderator Pending Queue
      const queueRes = await request
        .get('/api/requests/queue/pending')
        .set('Authorization', `Bearer ${modToken}`);
      assert.equal(queueRes.status, 200);
      assert.ok(queueRes.body.requests.some(r => r.id === reqId));

      // Step C: Moderator Approves -> Auto-Executes to Ledger under Scenario B
      const decideRes = await request
        .post(`/api/requests/${reqId}/decide`)
        .set('Authorization', `Bearer ${modToken}`)
        .send({ action: 'APPROVE', reason: 'Physical security elements verified under UV lamp' });

      assert.equal(decideRes.status, 200);
      assert.equal(decideRes.body.status, 'EXECUTED');
      assert.equal(decideRes.body.executed, true);
      assert.ok(decideRes.body.execution_tx_id);

      // Step D: Stored record verified
      const record = repos.requests.getById(reqId);
      assert.equal(record.status, 'EXECUTED');
      assert.equal(record.moderator_id, 'usr_mod_full');
    });

    test('2.2 Flow B: Soft-Channel Issuance escalates to Root and executes on Root Accept', async () => {
      // Step A: Clerk intake with SHA-256 evidence
      const intakeRes = await request
        .post('/api/requests/issue')
        .set('Authorization', `Bearer ${clerkToken}`)
        .send({
          submission_channel: 'soft',
          claimant_data: {
            fullName: 'Beatrice Gomez',
            identifierNumber: 'SCT-SFT-2026-02'
          },
          evidence_sha256: 'e'.repeat(64)
        });
      assert.equal(intakeRes.status, 201);
      const reqId = intakeRes.body.requestId;

      // Step B: Moderator Approves -> Escalates to Root (NOT auto-executed)
      const decideRes = await request
        .post(`/api/requests/${reqId}/decide`)
        .set('Authorization', `Bearer ${modToken}`)
        .send({ action: 'APPROVE', reason: 'Digital scan resolution conforms to 300DPI requirement' });

      assert.equal(decideRes.status, 200);
      assert.equal(decideRes.body.status, 'AWAITING_ROOT_ACCEPT');
      assert.equal(decideRes.body.executed, false);

      // Step C: Appears in Root Awaiting Accept Queue
      const rootQueueRes = await request
        .get('/api/requests/queue/awaiting-root')
        .set('Authorization', `Bearer ${rootToken}`);
      assert.equal(rootQueueRes.status, 200);
      assert.ok(rootQueueRes.body.requests.some(r => r.id === reqId));

      // Step D: Root executes
      const execRes = await request
        .post(`/api/requests/${reqId}/root-execute`)
        .set('Authorization', `Bearer ${rootToken}`)
        .send({ action: 'ACCEPT' });

      assert.equal(execRes.status, 200);
      assert.equal(execRes.body.status, 'EXECUTED');
      assert.equal(execRes.body.executed, true);
      assert.ok(execRes.body.execution_tx_id);

      const record = repos.requests.getById(reqId);
      assert.equal(record.status, 'EXECUTED');
      assert.equal(record.root_id, 'usr_root_full');
    });

    test('2.3 Flow C: Revocation strictly escalates to Root regardless of channel', async () => {
      // Step A: Clerk intake
      const intakeRes = await request
        .post('/api/requests/revoke')
        .set('Authorization', `Bearer ${clerkToken}`)
        .send({
          credential_id: 'cred_lost_card_99',
          reason: 'Reported lost by holder',
          submission_channel: 'hard'
        });
      assert.equal(intakeRes.status, 201);
      const reqId = intakeRes.body.requestId;

      // Step B: Moderator Approves -> MUST escalate to Root
      const decideRes = await request
        .post(`/api/requests/${reqId}/decide`)
        .set('Authorization', `Bearer ${modToken}`)
        .send({ action: 'APPROVE', reason: 'Incident report verified' });

      assert.equal(decideRes.status, 200);
      assert.equal(decideRes.body.status, 'AWAITING_ROOT_ACCEPT');
      assert.equal(decideRes.body.executed, false);

      // Step C: Root executes revocation
      const execRes = await request
        .post(`/api/requests/${reqId}/root-execute`)
        .set('Authorization', `Bearer ${rootToken}`)
        .send({ action: 'ACCEPT' });

      assert.equal(execRes.status, 200);
      assert.equal(execRes.body.status, 'EXECUTED');
      assert.ok(execRes.body.execution_tx_id.startsWith('tx_fabric_revoke_'));

      const record = repos.requests.getById(reqId);
      assert.equal(record.status, 'EXECUTED');
      assert.equal(record.request_type, 'revocation');
    });
  });

  // =========================================================================
  // SUITE 3: REJECTION & FLAGGING WORKFLOWS
  // =========================================================================
  describe('3. Rejection & Flagging Workflows', () => {
    test('3.1 Moderator rejection requires a mandatory reason', async () => {
      const intakeRes = await request
        .post('/api/requests/issue')
        .set('Authorization', `Bearer ${clerkToken}`)
        .send({
          submission_channel: 'hard',
          claimant_data: { fullName: 'Rejected Claimant' },
          inspection_checklist_verified: true
        });
      const reqId = intakeRes.body.requestId;

      // Reject without reason fails (400)
      const failRes = await request
        .post(`/api/requests/${reqId}/decide`)
        .set('Authorization', `Bearer ${modToken}`)
        .send({ action: 'REJECT' });
      assert.equal(failRes.status, 400);
      assert.equal(failRes.body.error, 'REASON_REQUIRED');

      // Reject with reason succeeds
      const okRes = await request
        .post(`/api/requests/${reqId}/decide`)
        .set('Authorization', `Bearer ${modToken}`)
        .send({ action: 'REJECT', reason: 'Counterfeit hologram strip detected' });
      assert.equal(okRes.status, 200);
      assert.equal(okRes.body.status, 'REJECTED');

      const record = repos.requests.getById(reqId);
      assert.equal(record.status, 'REJECTED');
      assert.equal(record.moderator_action, 'REJECT');
    });

    test('3.2 Moderator flagging requires a mandatory reason and moves to FLAGGED queue', async () => {
      const intakeRes = await request
        .post('/api/requests/issue')
        .set('Authorization', `Bearer ${clerkToken}`)
        .send({
          submission_channel: 'hard',
          claimant_data: { fullName: 'Suspicious Case' },
          inspection_checklist_verified: true
        });
      const reqId = intakeRes.body.requestId;

      // Flag without reason fails (400)
      const failRes = await request
        .post(`/api/requests/${reqId}/decide`)
        .set('Authorization', `Bearer ${modToken}`)
        .send({ action: 'FLAG' });
      assert.equal(failRes.status, 400);
      assert.equal(failRes.body.error, 'REASON_REQUIRED');

      // Flag with reason succeeds
      const okRes = await request
        .post(`/api/requests/${reqId}/decide`)
        .set('Authorization', `Bearer ${modToken}`)
        .send({ action: 'FLAG', reason: 'Biometric mismatch exceeds threshold; investigation needed' });
      assert.equal(okRes.status, 200);
      assert.equal(okRes.body.status, 'FLAGGED');

      // Appears in Root Flagged queue
      const flaggedRes = await request
        .get('/api/requests/queue/flagged')
        .set('Authorization', `Bearer ${rootToken}`);
      assert.equal(flaggedRes.status, 200);
      assert.ok(flaggedRes.body.requests.some(r => r.id === reqId));
    });
  });

  // =========================================================================
  // SUITE 4: CRYPTOGRAPHIC KEY ROTATION & DISASTER RECOVERY
  // =========================================================================
  describe('4. Cryptographic Key Rotation & Disaster Recovery', () => {
    test('4.1 PQC Key Pool can be listed by Moderator and Root', async () => {
      const res = await request
        .get('/api/keys/pqc/pool')
        .set('Authorization', `Bearer ${modToken}`);
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.keys));
      assert.ok(res.body.keys.length >= 1);
    });

    test('4.2 Promotion of pre-staged PQC key to active by Root', async () => {
      // Without key_id -> 400
      const failRes = await request
        .post('/api/keys/pqc/promote')
        .set('Authorization', `Bearer ${rootToken}`)
        .send({});
      assert.equal(failRes.status, 400);
      assert.equal(failRes.body.error, 'KEY_ID_REQUIRED');

      // Promote staged key -> succeeds
      const okRes = await request
        .post('/api/keys/pqc/promote')
        .set('Authorization', `Bearer ${rootToken}`)
        .send({
          key_id: 'pqc-mldsa87-flow-staged-v2',
          reason: 'Emergency cryptographic cutover drills'
        });
      assert.equal(okRes.status, 200);
      assert.equal(okRes.body.success, true);
      assert.equal(okRes.body.activeKey.key_id, 'pqc-mldsa87-flow-staged-v2');
    });

    test('4.3 Gateway Dual-Key Zero-Downtime Rotation executes with grace window', async () => {
      const res = await request
        .post('/api/keys/gateway/rotate')
        .set('Authorization', `Bearer ${rootToken}`)
        .send({
          key_name: 'VERIFICATION_API_KEY',
          grace_window_hours: 48
        });
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.graceWindowHours, 48);
      assert.ok(res.body.keyId);
    });

    test('4.4 AES-256-GCM encrypted backup envelope export and restore', async () => {
      const exportRes = await request
        .post('/api/keys/pqc/export')
        .set('Authorization', `Bearer ${rootToken}`)
        .send({ master_passphrase: 'BackupMasterKeyPass2026!' });

      assert.equal(exportRes.status, 200);
      assert.ok(exportRes.body.envelope);
      const envelopeString = exportRes.body.envelope;
      const envelopeJson = JSON.parse(envelopeString);
      assert.equal(envelopeJson.format, 'SCATTERID_PQC_ENVELOPE_V1');
      assert.equal(envelopeJson.algorithm, 'AES-256-GCM');
      assert.ok(envelopeJson.ciphertext_hex);
      assert.ok(envelopeJson.auth_tag_hex);

      // Restore
      const restoreRes = await request
        .post('/api/keys/pqc/restore')
        .set('Authorization', `Bearer ${rootToken}`)
        .send({
          envelope: envelopeString,
          master_passphrase: 'BackupMasterKeyPass2026!'
        });
      assert.equal(restoreRes.status, 200);
      assert.equal(restoreRes.body.success, true);
    });
  });

  // =========================================================================
  // SUITE 5: SYSTEM HEALTH RECONCILIATION & AUDIT ATTRIBUTION
  // =========================================================================
  describe('5. System Health Reconciliation & Audit Attribution', () => {
    test('5.1 Root manual reconciliation probe returns in-sync status', async () => {
      const res = await request
        .post('/api/requests/reconcile')
        .set('Authorization', `Bearer ${rootToken}`);
      assert.equal(res.status, 200);
      assert.equal(res.body.status, 'in_sync');
      assert.equal(res.body.driftDetected, false);
    });

    test('5.2 Full attribution recorded in Audit Log for all managerial actions', async () => {
      const res = await request
        .get('/api/requests/audit-log')
        .set('Authorization', `Bearer ${rootToken}`);
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.logs));
      assert.ok(res.body.logs.length > 5);

      // Verify that every audit log has complete attribution stamps
      for (const log of res.body.logs.slice(0, 10)) {
        assert.ok(log.action, 'Audit entry must have action');
        assert.ok(log.actor_id, 'Audit entry must have actor_id');
        assert.ok(log.role, 'Audit entry must have role');
        assert.ok(log.timestamp, 'Audit entry must have timestamp');
      }
    });
  });
});
