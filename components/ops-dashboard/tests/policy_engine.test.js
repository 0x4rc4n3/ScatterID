// Agile Policy & Governance Engine Integration Tests
// Validates customizable risk postures (Scenario B, Scenario A, Scenario C, Custom)
// Document ID: DEV-ARCH-08 / ISSUE-102

process.env.JWT_SECRET = process.env.JWT_SECRET || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
import { describe, test, before, after, beforeEach } from 'node:test';
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
import { resetPolicyToDefault, getActivePolicy } from '../src/policy/routingPolicy.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_DB_PATH = path.resolve(__dirname, 'test_policy_engine.db');

function cleanupTestDb() {
  for (const suffix of ['', '-wal', '-shm']) {
    const file = `${TEST_DB_PATH}${suffix}`;
    if (fs.existsSync(file)) {
      try { fs.unlinkSync(file); } catch (e) {}
    }
  }
}

describe('Agile Policy Engine & Dynamic Governance (ISSUE-102)', () => {
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
    repos.users.createUser({ id: 'clk_pol_01', username: 'clerk_pol', password_hash: pHash, role: 'clerk', station_id: 'counter-pol' });
    repos.users.createUser({ id: 'mod_pol_01', username: 'mod_pol', password_hash: pHash, role: 'mod' });
    repos.users.createUser({ id: 'root_pol_01', username: 'root_pol', password_hash: pHash, role: 'root' });

    clerkToken = signToken({ userId: 'clk_pol_01', username: 'clerk_pol', role: 'clerk', stationId: 'counter-pol' });
    modToken = signToken({ userId: 'mod_pol_01', username: 'mod_pol', role: 'mod' });
    rootToken = signToken({ userId: 'root_pol_01', username: 'root_pol', role: 'root' });
  });

  after(() => {
    if (db) {
      try { db.close(); } catch (e) {}
    }
    cleanupTestDb();
    resetPolicyToDefault();
  });

  beforeEach(() => {
    resetPolicyToDefault();
  });

  test('1. Default Policy is Scenario B (Tiered Risk)', async () => {
    const res = await request
      .get('/api/requests/policy')
      .set('Authorization', `Bearer ${clerkToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.active.name, 'Scenario B — Tiered Risk Policy');
    assert.equal(res.body.active.issuance.hard, 'AUTO_EXECUTE');
    assert.equal(res.body.active.issuance.soft, 'ROUTE_TO_ROOT');
    assert.equal(res.body.active.revocation.hard, 'ROUTE_TO_ROOT');
  });

  test('2. Non-Root users CANNOT alter governance policy (403 Forbidden)', async () => {
    const modAttempt = await request
      .post('/api/requests/policy')
      .set('Authorization', `Bearer ${modToken}`)
      .send({ profile: 'SCENARIO_A' });

    assert.equal(modAttempt.status, 403);

    const clerkAttempt = await request
      .post('/api/requests/policy')
      .set('Authorization', `Bearer ${clerkToken}`)
      .send({ profile: 'SCENARIO_A' });

    assert.equal(clerkAttempt.status, 403);
  });

  test('3. Root switches to Scenario A (Strict Dual-Control) -> Hard Issue GATES to Root', async () => {
    // Switch to Scenario A
    const updateRes = await request
      .post('/api/requests/policy')
      .set('Authorization', `Bearer ${rootToken}`)
      .send({ profile: 'SCENARIO_A' });

    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.body.activePolicy.name, 'Scenario A — Strict Dual-Control Policy');

    // Intake Hard Channel Issue
    const intakeRes = await request
      .post('/api/requests/issue')
      .set('Authorization', `Bearer ${clerkToken}`)
      .send({
        submission_channel: 'hard',
        claimant_data: { fullName: 'Alice Strict', nationalId: 'NAT-STRICT-001' },
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

    // Moderator approves -> Under Scenario A, it MUST NOT auto-execute; must gate to Root
    const modDecide = await request
      .post(`/api/requests/${reqId}/decide`)
      .set('Authorization', `Bearer ${modToken}`)
      .send({ action: 'APPROVE', reason: 'Hard document inspection verified' });

    assert.equal(modDecide.status, 200);
    assert.equal(modDecide.body.status, 'AWAITING_ROOT_ACCEPT');
    assert.equal(modDecide.body.executed, false);

    const stored = repos.requests.getById(reqId);
    assert.equal(stored.status, 'AWAITING_ROOT_ACCEPT');
    assert.equal(stored.execution_tx_id, null);
  });

  test('4. Root switches to Scenario C (Delegated Autonomy) -> Soft Issue AUTO-EXECUTES', async () => {
    // Switch to Scenario C
    const updateRes = await request
      .post('/api/requests/policy')
      .set('Authorization', `Bearer ${rootToken}`)
      .send({ profile: 'SCENARIO_C' });

    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.body.activePolicy.name, 'Scenario C — Delegated Operational Autonomy');

    // Intake Soft Channel Issue
    const intakeRes = await request
      .post('/api/requests/issue')
      .set('Authorization', `Bearer ${clerkToken}`)
      .send({
        submission_channel: 'soft',
        claimant_data: { fullName: 'Bob Fast', nationalId: 'NAT-FAST-002' },
        evidence_sha256: 'c'.repeat(64)
      });
    assert.equal(intakeRes.status, 201);
    const reqId = intakeRes.body.requestId;

    // Moderator approves -> Under Scenario C, Soft Channel AUTO-EXECUTES directly to ledger
    const modDecide = await request
      .post(`/api/requests/${reqId}/decide`)
      .set('Authorization', `Bearer ${modToken}`)
      .send({ action: 'APPROVE', reason: 'High throughput expedited batch' });

    assert.equal(modDecide.status, 200);
    assert.equal(modDecide.body.status, 'EXECUTED');
    assert.equal(modDecide.body.executed, true);
    assert.ok(modDecide.body.execution_tx_id);

    const stored = repos.requests.getById(reqId);
    assert.equal(stored.status, 'EXECUTED');
    assert.ok(stored.execution_tx_id);
  });

  test('5. Root configures Custom Policy configuration dynamically', async () => {
    const customConfig = {
      name: 'Custom Enterprise Tier',
      description: 'Issuance hard routed to root, revocations auto-executed for low risk',
      issuance: { hard: 'ROUTE_TO_ROOT', soft: 'ROUTE_TO_ROOT' },
      revocation: { hard: 'AUTO_EXECUTE', soft: 'ROUTE_TO_ROOT' }
    };

    const updateRes = await request
      .post('/api/requests/policy')
      .set('Authorization', `Bearer ${rootToken}`)
      .send({ customConfig });

    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.body.activePolicy.name, 'Custom Enterprise Tier');

    const active = getActivePolicy();
    assert.equal(active.name, 'Custom Enterprise Tier');
    assert.equal(active.revocation.hard, 'AUTO_EXECUTE');
  });

  test('6. Invalid policy profile rejected with descriptive error', async () => {
    const invalidRes = await request
      .post('/api/requests/policy')
      .set('Authorization', `Bearer ${rootToken}`)
      .send({ profile: 'NON_EXISTENT_PROFILE' });

    assert.equal(invalidRes.status, 400);
    assert.equal(invalidRes.body.error, 'POLICY_UPDATE_FAILED');
  });
});
