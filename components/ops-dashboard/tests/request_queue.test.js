// Automated Unit & Integration Tests for Phase 3: Request Intake & Audit Attribution Queue
// Document ID: DEV-ARCH-08 / ADDENDUM-01 / SEC-OPS-06

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
import { signToken } from '../src/auth/tokens.js';
import { createApp } from '../src/server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_DB_PATH = path.resolve(__dirname, 'test_requests.db');

function cleanupTestDb() {
  for (const suffix of ['', '-wal', '-shm']) {
    const file = `${TEST_DB_PATH}${suffix}`;
    if (fs.existsSync(file)) {
      try { fs.unlinkSync(file); } catch (e) {}
    }
  }
}

describe('Phase 3: Request Intake & Audit Attribution Queue', () => {
  let db;
  let repos;
  let request;
  let clerkToken;
  let modToken;

  before(async () => {
    cleanupTestDb();
    const initResult = initDb(TEST_DB_PATH);
    db = initResult.db;
    migrateUp(db);
    repos = createRepositories(db);

    const appObj = createApp({ db, repos });
    request = supertest(appObj.app);

    const pHash = await hashPassword('TestPass123!');
    repos.users.createUser({
      id: 'clk_042',
      username: 'alice_counter',
      password_hash: pHash,
      role: 'clerk',
      station_id: 'counter-station-03'
    });

    repos.users.createUser({
      id: 'mod_007',
      username: 'bob_moderator',
      password_hash: pHash,
      role: 'mod'
    });

    clerkToken = signToken({
      userId: 'clk_042',
      username: 'alice_counter',
      role: 'clerk',
      stationId: 'counter-station-03'
    });

    modToken = signToken({
      userId: 'mod_007',
      username: 'bob_moderator',
      role: 'mod'
    });
  });

  after(() => {
    if (db) {
      try { db.close(); } catch (e) {}
    }
    cleanupTestDb();
  });

  test('1. Hard Channel Issuance with Complete Physical Checklist', async () => {
    const res = await request
      .post('/api/requests/issue')
      .set('Authorization', `Bearer ${clerkToken}`)
      .set('X-Forwarded-For', '10.20.0.14')
      .send({
        submission_channel: 'hard',
        claimant_data: {
          fullName: 'Robert Frost',
          nationalId: 'NAT-USA-998811',
          dateOfBirth: '1985-03-26'
        },
        inspection_checklist: {
          substrate_material_integrity: true,
          optical_security_features: true,
          biometric_face_match: true,
          authority_seal_and_serial: true
        }
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.status, 'PENDING');
    assert.equal(res.body.submission_channel, 'hard');
    assert.ok(res.body.requestId);

    // Verify Clerk Attribution Stamp
    assert.equal(res.body.attribution.staff_user_id, 'clk_042');
    assert.equal(res.body.attribution.username, 'alice_counter');
    assert.equal(res.body.attribution.station_id, 'counter-station-03');
    assert.equal(res.body.attribution.client_ip, '10.20.0.14');

    // Verify DB record and Data Minimization (evidence_sha256 must be null)
    const stored = repos.requests.getById(res.body.requestId);
    assert.equal(stored.inspection_checklist_verified, 1);
    assert.equal(stored.evidence_sha256, null);

    // Verify Immutable Audit Trail Entry
    const auditLogs = repos.auditLog.getByRequestId(res.body.requestId);
    assert.equal(auditLogs.length, 1);
    assert.equal(auditLogs[0].action, 'CLERK_REQUEST_SUBMITTED');
    assert.equal(auditLogs[0].station_id, 'counter-station-03');
    assert.equal(auditLogs[0].client_ip, '10.20.0.14');
  });

  test('2. Hard Channel Issuance Rejects Incomplete Inspection Checklist', async () => {
    // Missing optical_security_features
    const res = await request
      .post('/api/requests/issue')
      .set('Authorization', `Bearer ${clerkToken}`)
      .send({
        submission_channel: 'hard',
        claimant_data: { fullName: 'Failing Claimant' },
        inspection_checklist: {
          substrate_material_integrity: true,
          optical_security_features: false, // failed
          biometric_face_match: true,
          authority_seal_and_serial: true
        }
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'CHECKLIST_INCOMPLETE');
  });

  test('3. Soft Channel Issuance with Digital Scan Upload & SHA-256 Hash', async () => {
    const samplePayload = 'Simulated Document PDF Content In Bytes';
    const expectedSha256 = crypto.createHash('sha256').update(samplePayload).digest('hex');

    const res = await request
      .post('/api/requests/issue')
      .set('Authorization', `Bearer ${clerkToken}`)
      .send({
        submission_channel: 'soft',
        claimant_data: {
          fullName: 'Grace Hopper',
          nationalId: 'NAT-DIG-443322'
        },
        evidence_payload_base64: Buffer.from(samplePayload).toString('base64')
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.status, 'PENDING');
    assert.equal(res.body.submission_channel, 'soft');

    const stored = repos.requests.getById(res.body.requestId);
    assert.equal(stored.inspection_checklist_verified, 0);
    assert.equal(stored.evidence_sha256, expectedSha256);

    const auditLogs = repos.auditLog.getByRequestId(res.body.requestId);
    assert.equal(auditLogs.length, 1);
    const details = JSON.parse(auditLogs[0].details);
    assert.equal(details.evidence_sha256, expectedSha256);
  });

  test('4. Soft Channel Rejects Missing or Malformed Evidence Hash', async () => {
    // Missing evidence
    const missingRes = await request
      .post('/api/requests/issue')
      .set('Authorization', `Bearer ${clerkToken}`)
      .send({
        submission_channel: 'soft',
        claimant_data: { fullName: 'No Scan User' }
      });
    assert.equal(missingRes.status, 400);
    assert.equal(missingRes.body.error, 'MISSING_EVIDENCE');

    // Malformed hash (invalid characters / wrong length)
    const malformedRes = await request
      .post('/api/requests/issue')
      .set('Authorization', `Bearer ${clerkToken}`)
      .send({
        submission_channel: 'soft',
        claimant_data: { fullName: 'Bad Hash User' },
        evidence_sha256: 'not-a-valid-sha256'
      });
    assert.equal(malformedRes.status, 400);
    assert.equal(malformedRes.body.error, 'INVALID_SHA256');
  });

  test('5. Help Desk Revocation Request Intake', async () => {
    const res = await request
      .post('/api/requests/revoke')
      .set('Authorization', `Bearer ${clerkToken}`)
      .set('X-Forwarded-For', '10.20.0.44')
      .send({
        credential_id: 'cred_target_uuid_999',
        reason: 'Claimant reported physical passport stolen in transit',
        submission_channel: 'hard'
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.status, 'PENDING');
    assert.equal(res.body.submission_channel, 'hard');

    const stored = repos.requests.getById(res.body.requestId);
    assert.equal(stored.request_type, 'revocation');
    assert.equal(stored.credential_id, 'cred_target_uuid_999');
    assert.equal(stored.reason, 'Claimant reported physical passport stolen in transit');

    // Missing reason must fail
    const noReasonRes = await request
      .post('/api/requests/revoke')
      .set('Authorization', `Bearer ${clerkToken}`)
      .send({ credential_id: 'cred_target_uuid_999' });
    assert.equal(noReasonRes.status, 400);
    assert.equal(noReasonRes.body.error, 'MISSING_REASON');
  });

  test('6. Safe Request Tracking Lookup (FR-H6)', async () => {
    // Create request
    const createRes = await request
      .post('/api/requests/issue')
      .set('Authorization', `Bearer ${clerkToken}`)
      .send({
        submission_channel: 'hard',
        claimant_data: { fullName: 'Track Me' },
        inspection_checklist_verified: true
      });

    const reqId = createRes.body.requestId;

    // Track request
    const trackRes = await request
      .get(`/api/requests/track/${reqId}`)
      .set('Authorization', `Bearer ${clerkToken}`);

    assert.equal(trackRes.status, 200);
    assert.equal(trackRes.body.id, reqId);
    assert.equal(trackRes.body.status, 'PENDING');
    // Ensure no private moderator notes or internal keys are leaked
    assert.equal(trackRes.body.moderator_reason, undefined);
    assert.equal(trackRes.body.totp_secret, undefined);
  });

  test('7. Moderator Pending Queue View (FR-10)', async () => {
    const pendingRes = await request
      .get('/api/requests/pending')
      .set('Authorization', `Bearer ${modToken}`);

    assert.equal(pendingRes.status, 200);
    assert.ok(pendingRes.body.count >= 3);
    assert.ok(Array.isArray(pendingRes.body.requests));

    // Clerk cannot access moderator pending queue
    const clerkBlockedRes = await request
      .get('/api/requests/pending')
      .set('Authorization', `Bearer ${clerkToken}`);
    assert.equal(clerkBlockedRes.status, 403);
  });
});
