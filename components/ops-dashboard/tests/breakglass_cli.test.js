// Automated Unit & Integration Tests for Phase 6: Offline Break-Glass Emergency CLI
// Document ID: SEC-OPS-06

process.env.JWT_SECRET = process.env.JWT_SECRET || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { initDb, migrateUp } from '../db/migrations/runner.js';
import { createRepositories } from '../db/models/index.js';
import { verifyPassword } from '../src/auth/passwords.js';
import { verifyTotpCode, decryptTotpSecret, generateTotpCode } from '../src/auth/totp.js';
import { restoreEncryptedEnvelope } from '../src/keys/backupEnvelope.js';
import { runCli } from '../../../tools/admin_cli.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_DB_PATH = path.resolve(__dirname, 'test_breakglass.db');
const BACKUP_ENC_PATH = path.resolve(__dirname, 'test_cli_backup.enc');

function cleanupFiles() {
  for (const suffix of ['', '-wal', '-shm']) {
    const file = `${TEST_DB_PATH}${suffix}`;
    if (fs.existsSync(file)) {
      try { fs.unlinkSync(file); } catch (e) {}
    }
  }
  if (fs.existsSync(BACKUP_ENC_PATH)) {
    try { fs.unlinkSync(BACKUP_ENC_PATH); } catch (e) {}
  }
}

describe('Phase 6: Offline Break-Glass Emergency CLI', () => {
  let db;
  let repos;

  before(() => {
    cleanupFiles();
    const initResult = initDb(TEST_DB_PATH);
    db = initResult.db;
    migrateUp(db);
    repos = createRepositories(db);
  });

  after(() => {
    if (db) {
      try { db.close(); } catch (e) {}
    }
    cleanupFiles();
  });

  test('1. breakglass command resets Root admin, generates TOTP secret, recovery codes, and security alert', async () => {
    const result = await runCli([
      'breakglass',
      '--username', 'admin',
      '--password', 'EmergencyMasterPass2026!#Ultra'
    ], { customDb: db });

    assert.equal(result.success, true);
    assert.equal(result.username, 'admin');
    assert.equal(result.recoveryCodes.length, 8);

    // Verify user in SQLite
    const user = repos.users.findByUsername('admin');
    assert.ok(user);
    assert.equal(user.role, 'root');
    assert.equal(user.totp_enabled, 1);

    // Verify new password validates
    const passValid = await verifyPassword(user.password_hash, 'EmergencyMasterPass2026!#Ultra');
    assert.equal(passValid, true);

    // Verify new TOTP code validates
    const plainSecret = decryptTotpSecret(user.totp_secret);
    const code = generateTotpCode(plainSecret);
    assert.equal(verifyTotpCode(plainSecret, code), true);

    // Verify 8 recovery codes saved in recovery_codes table
    assert.equal(repos.recoveryCodes.getRemainingCount(user.id), 8);

    // Verify High-Priority Security Alert in audit_log
    const alerts = repos.auditLog.getRecent(10);
    const breakglassAlert = alerts.find(a => a.action === 'SECURITY_ALERT: ROOT_BREAKGLASS_EXECUTED');
    assert.ok(breakglassAlert);
    assert.equal(breakglassAlert.status, 'ALERT');
    assert.equal(breakglassAlert.caller_tier, 'host_offline_cli');
  });

  test('2. --reset-mfa command purges TOTP seed and recovery codes', async () => {
    const result = await runCli([
      '--reset-mfa',
      '--username', 'admin'
    ], { customDb: db });

    assert.equal(result.success, true);
    assert.equal(result.mfaReset, true);

    const user = repos.users.findByUsername('admin');
    assert.equal(user.totp_enabled, 0);
    assert.equal(user.totp_secret, null);
    assert.equal(repos.recoveryCodes.getRemainingCount(user.id), 0);

    const alerts = repos.auditLog.getRecent(5);
    assert.ok(alerts.some(a => a.action === 'SECURITY_ALERT: MFA_RESET_OFFLINE_CLI'));
  });

  test('3. --reset-password command updates password and enforces complexity', async () => {
    // Password too short for root (< 16 chars) must throw
    await assert.rejects(async () => {
      await runCli([
        '--reset-password',
        '--username', 'admin',
        '--password', 'Short123!'
      ], { customDb: db });
    }, /at least 16 characters/i);

    // Valid password
    const result = await runCli([
      '--reset-password',
      '--username', 'admin',
      '--password', 'FreshNewMasterPassword2026!#Compliant'
    ], { customDb: db });

    assert.equal(result.success, true);

    const user = repos.users.findByUsername('admin');
    const valid = await verifyPassword(user.password_hash, 'FreshNewMasterPassword2026!#Compliant');
    assert.equal(valid, true);

    const alerts = repos.auditLog.getRecent(5);
    assert.ok(alerts.some(a => a.action === 'SECURITY_ALERT: PASSWORD_RESET_OFFLINE_CLI'));
  });

  test('4. --export-backup exports AES-256-GCM envelope and verifies decryptable', async () => {
    // Add sample key to pool
    repos.pqcKeys.addKeyToPool({
      key_id: 'pqc-mldsa87-cli-test-v1',
      algorithm: 'ML-DSA-87',
      public_key_hex: '0102030405060708',
      public_key_id_sha3: 'sha3_hex',
      status: 'active',
      sequence_number: 99
    });

    const passphrase = 'UltraSecureBackupPassphrase2026!#Offline';
    const result = await runCli([
      '--export-backup',
      '--out', BACKUP_ENC_PATH,
      '--passphrase', passphrase
    ], { customDb: db });

    assert.equal(result.success, true);
    assert.ok(fs.existsSync(BACKUP_ENC_PATH));

    const content = fs.readFileSync(BACKUP_ENC_PATH, 'utf8');
    const restored = restoreEncryptedEnvelope({
      masterPassphrase: passphrase,
      envelopeContent: content
    });

    assert.ok(restored.keys.some(k => k.key_id === 'pqc-mldsa87-cli-test-v1'));

    const alerts = repos.auditLog.getRecent(5);
    assert.ok(alerts.some(a => a.action === 'SECURITY_ALERT: PQC_BACKUP_EXPORTED_OFFLINE_CLI'));
  });

  test('5. --rotate-pqc rotates active key from pre-staged pool', async () => {
    repos.pqcKeys.addKeyToPool({
      key_id: 'pqc-mldsa87-cli-test-v2',
      algorithm: 'ML-DSA-87',
      public_key_hex: '090a0b0c0d0e0f10',
      public_key_id_sha3: 'sha3_hex_2',
      status: 'pre_staged',
      sequence_number: 100
    });

    const result = await runCli([
      '--rotate-pqc',
      '--key-id', 'pqc-mldsa87-cli-test-v2',
      '--reason', 'Host CLI scheduled emergency cutover'
    ], { customDb: db });

    assert.equal(result.success, true);
    assert.equal(result.activeKey.key_id, 'pqc-mldsa87-cli-test-v2');
    assert.equal(repos.pqcKeys.getActiveKey().key_id, 'pqc-mldsa87-cli-test-v2');

    const alerts = repos.auditLog.getRecent(5);
    assert.ok(alerts.some(a => a.action === 'SECURITY_ALERT: PQC_ROTATION_OFFLINE_CLI'));
  });
});
