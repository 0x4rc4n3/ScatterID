// Automated Unit & Integration Tests for Phase 5: PQC Key Lifecycle, Pre-Distribution & Dual-Key Grace
// Document ID: SEC-OPS-06

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
import { exportEncryptedEnvelope, restoreEncryptedEnvelope } from '../src/keys/backupEnvelope.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_DB_PATH = path.resolve(__dirname, 'test_key_lifecycle.db');

function cleanupTestDb() {
  for (const suffix of ['', '-wal', '-shm']) {
    const file = `${TEST_DB_PATH}${suffix}`;
    if (fs.existsSync(file)) {
      try { fs.unlinkSync(file); } catch (e) {}
    }
  }
}

describe('Phase 5: PQC Key Lifecycle, Pre-Distribution & Dual-Key Grace', () => {
  let db;
  let repos;
  let request;
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

    const pHash = await hashPassword('AdminPass2026!');
    repos.users.createUser({ id: 'mod_key_01', username: 'mod_karen', password_hash: pHash, role: 'mod' });
    repos.users.createUser({ id: 'root_key_01', username: 'root_kevin', password_hash: pHash, role: 'root' });

    modToken = signToken({ userId: 'mod_key_01', username: 'mod_karen', role: 'mod' });
    rootToken = signToken({ userId: 'root_key_01', username: 'root_kevin', role: 'root' });
  });

  after(() => {
    if (db) {
      try { db.close(); } catch (e) {}
    }
    cleanupTestDb();
  });

  test('1. Gateway Dual-Key Zero-Downtime Rotation & Grace Window Validation', async () => {
    // Step A: Root rotates REVOKE_API_KEY (1st key)
    const rot1 = await request
      .post('/api/keys/gateway/rotate')
      .set('Authorization', `Bearer ${rootToken}`)
      .send({ key_name: 'REVOKE_API_KEY', grace_window_hours: 24 });

    assert.equal(rot1.status, 200);
    assert.ok(rot1.body.plaintextKey);
    const key1 = rot1.body.plaintextKey;

    // Validate key 1 is active
    const val1 = await request
      .post('/api/keys/gateway/validate')
      .send({ key_name: 'REVOKE_API_KEY', token: key1 });
    assert.equal(val1.status, 200);
    assert.equal(val1.body.valid, true);
    assert.equal(val1.body.status, 'active');

    // Step B: Root rotates REVOKE_API_KEY again (2nd key)
    const rot2 = await request
      .post('/api/keys/gateway/rotate')
      .set('Authorization', `Bearer ${rootToken}`)
      .send({ key_name: 'REVOKE_API_KEY', grace_window_hours: 48 });

    assert.equal(rot2.status, 200);
    const key2 = rot2.body.plaintextKey;

    // Dual-Key Invariant: Key 2 is active, Key 1 is still accepted under grace window
    const val2Active = await request
      .post('/api/keys/gateway/validate')
      .send({ key_name: 'REVOKE_API_KEY', token: key2 });
    assert.equal(val2Active.body.valid, true);
    assert.equal(val2Active.body.status, 'active');

    const val1Grace = await request
      .post('/api/keys/gateway/validate')
      .send({ key_name: 'REVOKE_API_KEY', token: key1 });
    assert.equal(val1Grace.body.valid, true);
    assert.equal(val1Grace.body.status, 'grace');

    // Random token must fail
    const valBad = await request
      .post('/api/keys/gateway/validate')
      .send({ key_name: 'REVOKE_API_KEY', token: 'invalid_token_xyz' });
    assert.equal(valBad.body.valid, false);

    // Step C: Mod views key status
    const statusRes = await request
      .get('/api/keys/gateway/status/REVOKE_API_KEY')
      .set('Authorization', `Bearer ${modToken}`);
    assert.equal(statusRes.status, 200);
    assert.ok(statusRes.body.activeKey);
    assert.equal(statusRes.body.graceKeys.length, 1);
  });

  test('2. Pre-Distributed PQC Key Pool Manager (Advance Pre-Staging & Promotion)', async () => {
    // Step A: Root pre-stages keys v1, v2, v3
    const pubKeyV1 = '0123456789abcdef'.repeat(8);
    const pubKeyV2 = 'fedcba9876543210'.repeat(8);

    const preStageV1 = await request
      .post('/api/keys/pqc/pre-stage')
      .set('Authorization', `Bearer ${rootToken}`)
      .send({
        key_id: 'pqc-mldsa87-2026-v1',
        algorithm: 'ML-DSA-87',
        public_key_hex: pubKeyV1,
        sequence_number: 10
      });
    assert.equal(preStageV1.status, 201);
    assert.equal(preStageV1.body.key.status, 'pre_staged');

    const preStageV2 = await request
      .post('/api/keys/pqc/pre-stage')
      .set('Authorization', `Bearer ${rootToken}`)
      .send({
        key_id: 'pqc-mldsa87-2026-v2',
        algorithm: 'ML-DSA-87',
        public_key_hex: pubKeyV2,
        sequence_number: 20
      });
    assert.equal(preStageV2.status, 201);

    // Step B: Promote v1 to active
    const promoteV1 = await request
      .post('/api/keys/pqc/promote')
      .set('Authorization', `Bearer ${rootToken}`)
      .send({ key_id: 'pqc-mldsa87-2026-v1' });
    assert.equal(promoteV1.status, 200);
    assert.equal(promoteV1.body.activeKey.status, 'active');

    // Step C: Promote v2 to active -> v1 must be retired
    const promoteV2 = await request
      .post('/api/keys/pqc/promote')
      .set('Authorization', `Bearer ${rootToken}`)
      .send({ key_id: 'pqc-mldsa87-2026-v2' });
    assert.equal(promoteV2.status, 200);
    assert.equal(promoteV2.body.activeKey.key_id, 'pqc-mldsa87-2026-v2');

    const poolRes = await request
      .get('/api/keys/pqc/pool')
      .set('Authorization', `Bearer ${modToken}`);
    assert.equal(poolRes.status, 200);
    assert.equal(poolRes.body.activeKey.key_id, 'pqc-mldsa87-2026-v2');
    const retiredV1 = poolRes.body.keys.find(k => k.key_id === 'pqc-mldsa87-2026-v1');
    assert.equal(retiredV1.status, 'retired');
  });

  test('3. Cryptographic Delegation Endorsement Token (Emergency Fallback Protocol)', async () => {
    // Endorsing key is active key v2
    const emergencyKeyHex = 'aabbccddeeff'.repeat(16);

    const delegRes = await request
      .post('/api/keys/pqc/delegation/create')
      .set('Authorization', `Bearer ${rootToken}`)
      .send({
        endorsing_key_id: 'pqc-mldsa87-2026-v2',
        delegated_key_id: 'pqc-mldsa87-2026-emergency-v99',
        delegated_public_key_hex: emergencyKeyHex,
        reason: 'EMERGENCY_ROTATION_PRESTAGED_POOL_COMPROMISED'
      });

    assert.equal(delegRes.status, 201);
    assert.ok(delegRes.body.endorsement);
    assert.ok(delegRes.body.endorsement.signature_by_endorser);

    const token = delegRes.body.endorsement;

    // Verify token offline
    const verifyRes = await request
      .post('/api/keys/pqc/delegation/verify')
      .send(token);
    assert.equal(verifyRes.status, 200);
    assert.equal(verifyRes.body.valid, true);
    assert.equal(verifyRes.body.delegated_key_id, 'pqc-mldsa87-2026-emergency-v99');

    // Tampered token fails verification
    const tamperedToken = { ...token, delegated_public_key_hex: '00'.repeat(12) };
    const verifyTampered = await request
      .post('/api/keys/pqc/delegation/verify')
      .send(tamperedToken);
    assert.equal(verifyTampered.body.valid, false);
    assert.equal(verifyTampered.body.reason, 'INVALID_ENDORSER_SIGNATURE');

    // Token with unknown endorsing key fails
    const verifyUnknown = await request
      .post('/api/keys/pqc/delegation/verify')
      .send({ ...token, endorsing_key_id: 'unknown_key_id_xyz' });
    assert.equal(verifyUnknown.body.valid, false);
    assert.equal(verifyUnknown.body.reason, 'UNKNOWN_ENDORSING_KEY');
  });

  test('4. AES-256-GCM Encrypted Backup Envelope (.enc) Export & Restore (FR-20)', async () => {
    const masterPassphrase = 'MasterVaultPassphrase2026!#Strong';

    // Step A: Root exports encrypted envelope
    const exportRes = await request
      .post('/api/keys/pqc/export')
      .set('Authorization', `Bearer ${rootToken}`)
      .send({ master_passphrase: masterPassphrase });

    assert.equal(exportRes.status, 200);
    assert.ok(exportRes.body.envelope);
    const envelopeString = exportRes.body.envelope;
    const envelopeJson = JSON.parse(envelopeString);

    assert.equal(envelopeJson.format, 'SCATTERID_PQC_ENVELOPE_V1');
    assert.equal(envelopeJson.algorithm, 'AES-256-GCM');
    assert.ok(envelopeJson.salt_hex);
    assert.ok(envelopeJson.auth_tag_hex);
    assert.ok(envelopeJson.ciphertext_hex);

    // Step B: Wrong passphrase fails decryption
    const badRestoreRes = await request
      .post('/api/keys/pqc/restore')
      .set('Authorization', `Bearer ${rootToken}`)
      .send({
        master_passphrase: 'WrongPassphrase123!',
        envelope: envelopeString
      });
    assert.equal(badRestoreRes.status, 500);
    assert.equal(badRestoreRes.body.error, 'RESTORE_FAILED');

    // Step C: Tampered ciphertext fails decryption
    const tamperedEnvelope = { ...envelopeJson, ciphertext_hex: 'ff' + envelopeJson.ciphertext_hex.slice(2) };
    const tamperedRestoreRes = await request
      .post('/api/keys/pqc/restore')
      .set('Authorization', `Bearer ${rootToken}`)
      .send({
        master_passphrase: masterPassphrase,
        envelope: tamperedEnvelope
      });
    assert.equal(tamperedRestoreRes.status, 500);

    // Step D: Valid restore succeeds
    const goodRestoreRes = await request
      .post('/api/keys/pqc/restore')
      .set('Authorization', `Bearer ${rootToken}`)
      .send({
        master_passphrase: masterPassphrase,
        envelope: envelopeString
      });
    assert.equal(goodRestoreRes.status, 200);
    assert.equal(goodRestoreRes.body.success, true);
    assert.ok(goodRestoreRes.body.restoredKeyCount >= 2);
  });

  test('5. Structural Role Separation for Key Management', async () => {
    // Mod cannot rotate gateway keys
    const modRotate = await request
      .post('/api/keys/gateway/rotate')
      .set('Authorization', `Bearer ${modToken}`)
      .send({ key_name: 'REVOKE_API_KEY' });
    assert.equal(modRotate.status, 403);

    // Mod cannot pre-stage PQC keys
    const modPreStage = await request
      .post('/api/keys/pqc/pre-stage')
      .set('Authorization', `Bearer ${modToken}`)
      .send({ key_id: 'mod_key' });
    assert.equal(modPreStage.status, 403);

    // Mod cannot promote keys
    const modPromote = await request
      .post('/api/keys/pqc/promote')
      .set('Authorization', `Bearer ${modToken}`)
      .send({ key_id: 'pqc-mldsa87-2026-v1' });
    assert.equal(modPromote.status, 403);

    // Mod cannot export encrypted backup
    const modExport = await request
      .post('/api/keys/pqc/export')
      .set('Authorization', `Bearer ${modToken}`)
      .send({ master_passphrase: 'some_passphrase' });
    assert.equal(modExport.status, 403);
  });
});
