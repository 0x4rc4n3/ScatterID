// Automated Unit, Integration & Rollback Tests for ScatterID Ops Database & Migration Engine
// Tests WAL mode, Foreign Key enforcement, Table Schemas, Constraints, and Rollback

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

import { initDb, migrateUp, migrateDown, getAppliedMigrations } from '../db/migrations/runner.js';
import { createRepositories } from '../db/models/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_DB_PATH = path.resolve(__dirname, 'test_ops.db');

function cleanupTestDb() {
  for (const suffix of ['', '-wal', '-shm']) {
    const file = `${TEST_DB_PATH}${suffix}`;
    if (fs.existsSync(file)) {
      try { fs.unlinkSync(file); } catch (e) {}
    }
  }
}

describe('Phase 1: Database Schema & Migration Engine', () => {
  let db;

  before(() => {
    cleanupTestDb();
  });

  after(() => {
    if (db) {
      try { db.close(); } catch (e) {}
    }
    cleanupTestDb();
  });

  test('1. Non-negotiable Architectural Invariants: WAL mode & Foreign Keys', () => {
    const initResult = initDb(TEST_DB_PATH);
    db = initResult.db;

    const journalMode = db.pragma('journal_mode', { simple: true });
    const foreignKeys = db.pragma('foreign_keys', { simple: true });
    const busyTimeout = db.pragma('busy_timeout', { simple: true });

    assert.equal(journalMode.toLowerCase(), 'wal', 'Journal mode must be WAL');
    assert.equal(foreignKeys, 1, 'Foreign keys pragma must be enabled (1)');
    assert.equal(busyTimeout, 5000, 'Busy timeout must be configured');
  });

  test('2. Forward Migration (migrateUp) creates all 7 tables and migration tracking', () => {
    const results = migrateUp(db);
    assert.equal(results.length, 1);
    assert.equal(results[0].status, 'APPLIED');
    assert.equal(results[0].version, '001');

    // Verify tables exist in sqlite_master
    const tableRows = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name ASC
    `).all();
    const tableNames = tableRows.map(r => r.name);

    const requiredTables = [
      'audit_log',
      'delegation_endorsements',
      'gateway_keys',
      'pqc_key_pool',
      'recovery_codes',
      'requests',
      'schema_migrations',
      'users'
    ];

    for (const reqTable of requiredTables) {
      assert.ok(tableNames.includes(reqTable), `Required table "${reqTable}" must exist in database`);
    }

    // Verify migration tracking record
    const applied = getAppliedMigrations(db);
    assert.equal(applied.length, 1);
    assert.equal(applied[0].version, '001');
    assert.equal(applied[0].name, 'initial_ops_schema');
  });

  test('3. Users Table constraints, roles, and unique enforcement', () => {
    const repos = createRepositories(db);

    // Valid clerk creation
    const clerk = repos.users.createUser({
      id: 'clk_001',
      username: 'clerk_alice',
      password_hash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhash1',
      role: 'clerk',
      station_id: 'counter-station-01'
    });
    assert.equal(clerk.username, 'clerk_alice');
    assert.equal(clerk.role, 'clerk');

    // Valid mod creation
    repos.users.createUser({
      id: 'mod_001',
      username: 'mod_bob',
      password_hash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhash2',
      role: 'mod'
    });

    // Valid root creation
    repos.users.createUser({
      id: 'root_001',
      username: 'root_carol',
      password_hash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhash3',
      role: 'root'
    });

    // CHECK constraint: invalid role must fail
    assert.throws(() => {
      repos.users.createUser({
        id: 'bad_001',
        username: 'bad_role_user',
        password_hash: 'hash',
        role: 'superadmin' // not in clerk, mod, root
      });
    }, /CHECK constraint failed/i);

    // UNIQUE constraint: duplicate username must fail
    assert.throws(() => {
      repos.users.createUser({
        id: 'dup_001',
        username: 'clerk_alice',
        password_hash: 'different_hash',
        role: 'clerk'
      });
    }, /UNIQUE constraint failed/i);
  });

  test('4. Recovery Codes Table and cascade delete behavior', () => {
    const repos = createRepositories(db);

    const testHashes = [
      'hash_code_1', 'hash_code_2', 'hash_code_3', 'hash_code_4',
      'hash_code_5', 'hash_code_6', 'hash_code_7', 'hash_code_8'
    ];

    repos.recoveryCodes.saveCodesForUser('root_001', testHashes);
    assert.equal(repos.recoveryCodes.getRemainingCount('root_001'), 8);

    // Consuming a code marks it used and reduces count
    const consumed = repos.recoveryCodes.verifyAndConsumeCode('root_001', 'hash_code_1');
    assert.equal(consumed, true);
    assert.equal(repos.recoveryCodes.getRemainingCount('root_001'), 7);

    // Attempting to consume same code again fails (single-use)
    const consumedAgain = repos.recoveryCodes.verifyAndConsumeCode('root_001', 'hash_code_1');
    assert.equal(consumedAgain, false);

    // Foreign key test: creating recovery code for non-existent user fails
    assert.throws(() => {
      db.prepare(`
        INSERT INTO recovery_codes (user_id, code_hash, used, created_at)
        VALUES ('non_existent_user', 'some_hash', 0, datetime('now'))
      `).run();
    }, /FOREIGN KEY constraint failed/i);

    // CASCADE delete test: deleting user removes associated recovery codes
    db.prepare("DELETE FROM users WHERE id = 'root_001'").run();
    assert.equal(repos.recoveryCodes.getRemainingCount('root_001'), 0);

    // Re-create root_001 for subsequent tests
    repos.users.createUser({
      id: 'root_001',
      username: 'root_carol',
      password_hash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhash3',
      role: 'root'
    });
  });

  test('5. Requests Moderation Queue: Hard vs. Soft Channel state flows', () => {
    const repos = createRepositories(db);

    // Hard-Channel Issuance Request
    const hardReq = repos.requests.createRequest({
      id: 'req_hard_001',
      request_type: 'issuance',
      submission_channel: 'hard',
      claimant_data: { fullName: 'John Doe', nationalId: 'NAT-998811' },
      inspection_checklist_verified: 1,
      evidence_sha256: null,
      clerk_id: 'clk_001',
      clerk_username: 'clerk_alice',
      station_id: 'counter-station-01',
      client_ip: '10.20.0.14'
    });
    assert.equal(hardReq.status, 'PENDING');
    assert.equal(hardReq.inspection_checklist_verified, 1);

    // Mod approves Hard-Channel Issuance -> System auto-executes
    repos.requests.updateModDecision('req_hard_001', {
      status: 'EXECUTED',
      moderator_id: 'mod_001',
      moderator_username: 'mod_bob',
      moderator_action: 'APPROVE',
      moderator_reason: 'Physical inspection checklist fully satisfied',
      execution_tx_id: 'tx_fabric_auto_001'
    });

    const updatedHard = repos.requests.getById('req_hard_001');
    assert.equal(updatedHard.status, 'EXECUTED');
    assert.equal(updatedHard.moderator_action, 'APPROVE');
    assert.equal(updatedHard.execution_tx_id, 'tx_fabric_auto_001');

    // Soft-Channel Issuance Request
    const softReq = repos.requests.createRequest({
      id: 'req_soft_001',
      request_type: 'issuance',
      submission_channel: 'soft',
      claimant_data: { fullName: 'Jane Smith', nationalId: 'NAT-554422' },
      inspection_checklist_verified: 0,
      evidence_sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      evidence_payload_path: '/vault/evidence/soft_001.enc',
      clerk_id: 'clk_001',
      clerk_username: 'clerk_alice',
      station_id: 'counter-station-01',
      client_ip: '10.20.0.14'
    });

    // Mod approves Soft-Channel Issuance -> Escalates to AWAITING_ROOT_ACCEPT
    repos.requests.updateModDecision('req_soft_001', {
      status: 'AWAITING_ROOT_ACCEPT',
      moderator_id: 'mod_001',
      moderator_username: 'mod_bob',
      moderator_action: 'APPROVE',
      moderator_reason: 'Soft scan meets legibility requirements'
    });

    const pendingRoot = repos.requests.getAwaitingRoot();
    assert.ok(pendingRoot.some(r => r.id === 'req_soft_001'));

    // Root accepts and executes
    repos.requests.updateRootDecision('req_soft_001', {
      status: 'EXECUTED',
      root_id: 'root_001',
      root_username: 'root_carol',
      root_action: 'ACCEPT',
      execution_tx_id: 'tx_fabric_root_002'
    });

    const executedSoft = repos.requests.getById('req_soft_001');
    assert.equal(executedSoft.status, 'EXECUTED');
    assert.equal(executedSoft.root_action, 'ACCEPT');
    assert.equal(executedSoft.execution_tx_id, 'tx_fabric_root_002');

    // Revocation Request (Hard Channel) -> Strictly requires Root accept
    const revokeReq = repos.requests.createRequest({
      id: 'req_rev_001',
      request_type: 'revocation',
      submission_channel: 'hard',
      credential_id: 'cred_target_001',
      reason: 'Physical card reported lost / compromised',
      inspection_checklist_verified: 1,
      clerk_id: 'clk_001',
      clerk_username: 'clerk_alice',
      station_id: 'counter-station-01'
    });

    // Mod approves -> Moves to AWAITING_ROOT_ACCEPT (never auto-executes)
    repos.requests.updateModDecision('req_rev_001', {
      status: 'AWAITING_ROOT_ACCEPT',
      moderator_id: 'mod_001',
      moderator_username: 'mod_bob',
      moderator_action: 'APPROVE',
      moderator_reason: 'Loss report confirmed'
    });

    const awaitingRevoke = repos.requests.getById('req_rev_001');
    assert.equal(awaitingRevoke.status, 'AWAITING_ROOT_ACCEPT');

    // CHECK constraint: invalid submission_channel throws
    assert.throws(() => {
      repos.requests.createRequest({
        id: 'bad_req',
        request_type: 'issuance',
        submission_channel: 'untrusted_channel',
        status: 'PENDING'
      });
    }, /CHECK constraint failed/i);
  });

  test('6. Immutable Audit Log with full attribution stamps', () => {
    const repos = createRepositories(db);

    const auditEntry = repos.auditLog.record({
      action: 'CLERK_INTAKE_SUBMITTED',
      status: 'SUCCESS',
      actor_id: 'clk_001',
      username: 'clerk_alice',
      role: 'clerk',
      station_id: 'counter-station-01',
      client_ip: '10.20.0.14',
      request_id: 'req_hard_001',
      submission_channel: 'hard',
      details: { inspection_checklist_verified: true, notes: 'Counter check pass' }
    });

    assert.ok(auditEntry.id > 0);
    assert.equal(auditEntry.action, 'CLERK_INTAKE_SUBMITTED');
    assert.equal(auditEntry.actor_id, 'clk_001');

    const byRequest = repos.auditLog.getByRequestId('req_hard_001');
    assert.ok(byRequest.length >= 1);
    assert.equal(byRequest[0].station_id, 'counter-station-01');
  });

  test('7. Gateway Keys Dual-Key Zero-Downtime Phasing', () => {
    const repos = createRepositories(db);

    // Initial rotation: sets key 1 as active
    const key1 = repos.gatewayKeys.rotateKey({
      id: 'gwk_001',
      key_name: 'REVOKE_API_KEY',
      key_hash: 'hash_primary_key_alpha',
      created_by: 'root_001'
    });
    assert.equal(key1.status, 'active');

    const check1 = repos.gatewayKeys.verifyKey('REVOKE_API_KEY', 'hash_primary_key_alpha');
    assert.equal(check1.valid, true);
    assert.equal(check1.status, 'active');

    // Dual-Key rotation: key 2 becomes active, key 1 demotes to grace window (24h)
    const key2 = repos.gatewayKeys.rotateKey({
      id: 'gwk_002',
      key_name: 'REVOKE_API_KEY',
      key_hash: 'hash_primary_key_bravo',
      graceWindowHours: 24,
      created_by: 'root_001'
    });
    assert.equal(key2.status, 'active');

    // Verify key 2 is active
    const check2 = repos.gatewayKeys.verifyKey('REVOKE_API_KEY', 'hash_primary_key_bravo');
    assert.equal(check2.valid, true);
    assert.equal(check2.status, 'active');

    // Verify key 1 is still accepted under grace window
    const check1Grace = repos.gatewayKeys.verifyKey('REVOKE_API_KEY', 'hash_primary_key_alpha');
    assert.equal(check1Grace.valid, true);
    assert.equal(check1Grace.status, 'grace');

    // Purging active grace key does not revoke it if within 24h
    repos.gatewayKeys.purgeExpiredGrace();
    const stillGrace = repos.gatewayKeys.verifyKey('REVOKE_API_KEY', 'hash_primary_key_alpha');
    assert.equal(stillGrace.valid, true);

    // Manually setting grace_expires_at in past and purging revokes it
    db.prepare("UPDATE gateway_keys SET grace_expires_at = '2020-01-01T00:00:00.000Z' WHERE id = 'gwk_001'").run();
    repos.gatewayKeys.purgeExpiredGrace();
    const expiredCheck = repos.gatewayKeys.verifyKey('REVOKE_API_KEY', 'hash_primary_key_alpha');
    assert.equal(expiredCheck.valid, false);
  });

  test('8. PQC Key Pool & Cryptographic Delegation Endorsements', () => {
    const repos = createRepositories(db);

    // Pre-staging keys
    const v1 = repos.pqcKeys.addKeyToPool({
      key_id: 'pqc-mldsa87-2025-v1',
      algorithm: 'ML-DSA-87',
      public_key_hex: '0102030405060708',
      public_key_id_sha3: 'sha3_id_v1',
      status: 'active',
      sequence_number: 1
    });
    assert.equal(v1.status, 'active');

    const v2 = repos.pqcKeys.addKeyToPool({
      key_id: 'pqc-mldsa87-2025-v2',
      algorithm: 'ML-DSA-87',
      public_key_hex: '090a0b0c0d0e0f10',
      public_key_id_sha3: 'sha3_id_v2',
      status: 'pre_staged',
      sequence_number: 2
    });
    assert.equal(v2.status, 'pre_staged');

    const preStaged = repos.pqcKeys.getPreStagedKeys();
    assert.equal(preStaged.length, 1);
    assert.equal(preStaged[0].key_id, 'pqc-mldsa87-2025-v2');

    // Promoting v2 retires v1 and activates v2
    repos.pqcKeys.activatePreStagedKey('pqc-mldsa87-2025-v2');
    const newActive = repos.pqcKeys.getActiveKey();
    assert.equal(newActive.key_id, 'pqc-mldsa87-2025-v2');
    assert.equal(repos.pqcKeys.getKeyById('pqc-mldsa87-2025-v1').status, 'retired');

    // Delegation Endorsement (Emergency Fallback when pool compromised)
    const delegation = repos.pqcKeys.createDelegationEndorsement({
      id: 'del_001',
      endorsing_key_id: 'pqc-mldsa87-2025-v2',
      delegated_key_id: 'pqc-mldsa87-2026-emergency-v99',
      delegated_public_key_hex: 'aabbccddeeff001122',
      valid_from: '2026-09-01T00:00:00Z',
      valid_until: '2027-09-01T00:00:00Z',
      reason: 'EMERGENCY_ROTATION_PRESTAGED_POOL_COMPROMISED',
      nonce: 'nonce_random_99182',
      signature_by_endorser: 'sig_endorser_mldsa87_hex',
      created_by: 'root_001'
    });
    assert.equal(delegation.delegated_key_id, 'pqc-mldsa87-2026-emergency-v99');

    // Foreign key enforcement: delegation with unknown endorsing key must fail
    assert.throws(() => {
      repos.pqcKeys.createDelegationEndorsement({
        id: 'del_bad',
        endorsing_key_id: 'non_existent_key_id',
        delegated_key_id: 'delegated_key_x',
        delegated_public_key_hex: 'hex',
        valid_from: '2026-09-01T00:00:00Z',
        valid_until: '2027-09-01T00:00:00Z',
        reason: 'test',
        nonce: 'nonce',
        signature_by_endorser: 'sig'
      });
    }, /FOREIGN KEY constraint failed/i);
  });

  test('9. Automated Rollback (migrateDown) and Idempotency', () => {
    // Run rollback
    const rollbackResult = migrateDown(db);
    assert.equal(rollbackResult.status, 'ROLLED_BACK');
    assert.equal(rollbackResult.version, '001');

    // Check that schema_migrations is now empty
    const appliedAfterRollback = getAppliedMigrations(db);
    assert.equal(appliedAfterRollback.length, 0);

    // Verify all 7 tables have been dropped
    const remainingTables = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != 'schema_migrations'
    `).all();
    assert.equal(remainingTables.length, 0, 'All business tables must be cleanly dropped on rollback');

    // Re-run forward migration (idempotent re-application)
    const reMigrateResults = migrateUp(db);
    assert.equal(reMigrateResults.length, 1);
    assert.equal(reMigrateResults[0].status, 'APPLIED');

    // Verify tables are restored
    const restoredTables = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `).all();
    assert.ok(restoredTables.length >= 8);

    // Calling migrateUp again reports ALREADY_APPLIED
    const secondCall = migrateUp(db);
    assert.equal(secondCall[0].status, 'ALREADY_APPLIED');
  });
});
