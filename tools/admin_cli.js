#!/usr/bin/env node

/**
 * ============================================================================
 * ScatterID — Offline Break-Glass Emergency CLI
 * Document ID: SEC-OPS-06 / Master Blueprint: start.md
 * ============================================================================
 * Interacts directly with the local SQLite database without requiring
 * an active HTTP server or network connectivity. Used by infrastructure
 * engineers and Root administrators for host/SSH emergency disaster recovery.
 *
 * Commands:
 *   node tools/admin_cli.js breakglass [--username <admin>] [--password <pass>]
 *   node tools/admin_cli.js --reset-mfa --username <user>
 *   node tools/admin_cli.js --reset-password --username <user> --password <pass>
 *   node tools/admin_cli.js --export-backup --out <file.enc> --passphrase <pass>
 *   node tools/admin_cli.js --rotate-pqc [--key-id <id>] [--reason <reason>]
 * ============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

import { getDb } from '../components/ops-dashboard/db/index.js';
import { createRepositories } from '../components/ops-dashboard/db/models/index.js';
import { hashPassword } from '../components/ops-dashboard/src/auth/passwords.js';
import {
  generateTotpSecret,
  encryptTotpSecret,
  getTotpUri,
  generateQrTerminalString
} from '../components/ops-dashboard/src/auth/totp.js';
import {
  generateRecoveryCodesBatch,
  hashRecoveryCode
} from '../components/ops-dashboard/src/auth/recoveryCodes.js';
import { exportEncryptedEnvelope } from '../components/ops-dashboard/src/keys/backupEnvelope.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseArgs(args) {
  const parsed = { _: [] };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
        parsed[key] = args[i + 1];
        i++;
      } else {
        parsed[key] = true;
      }
    } else {
      parsed._.push(arg);
    }
  }
  return parsed;
}

function generateHighEntropyPassword(length = 24) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*()_+';
  const bytes = crypto.randomBytes(length);
  let pass = '';
  for (let i = 0; i < length; i++) {
    pass += chars[bytes[i] % chars.length];
  }
  return pass;
}

export async function runCli(argv = process.argv.slice(2), { customDb = null } = {}) {
  const args = parseArgs(argv);
  const command = args._[0] || (args['reset-mfa'] && 'reset-mfa') || 
                  (args['reset-password'] && 'reset-password') || 
                  (args['export-backup'] && 'export-backup') || 
                  (args['rotate-pqc'] && 'rotate-pqc') || 
                  'help';

  const db = customDb || getDb();
  const repos = createRepositories(db);

  // 1. BREAKGLASS COMMAND
  if (command === 'breakglass') {
    const username = args.username || 'admin';
    const password = args.password || generateHighEntropyPassword(24);

    if (password.length < 16) {
      throw new Error('Break-glass password must be at least 16 characters long');
    }

    let user = repos.users.findByUsername(username);
    const now = new Date().toISOString();

    const pHash = await hashPassword(password);
    const newTotpSecret = generateTotpSecret();
    const encryptedSecret = encryptTotpSecret(newTotpSecret);
    const rawCodes = generateRecoveryCodesBatch(8);
    const codeHashes = rawCodes.map(hashRecoveryCode);

    const breakglassTx = db.transaction(() => {
      if (!user) {
        user = repos.users.createUser({
          id: `root_breakglass_${Date.now()}`,
          username,
          password_hash: pHash,
          role: 'root',
          totp_secret: encryptedSecret,
          totp_enabled: 1
        });
      } else {
        repos.users.updatePassword(user.id, pHash, 0);
        repos.users.updateTotp(user.id, {
          totp_secret: encryptedSecret,
          totp_enabled: 1
        });
      }

      repos.recoveryCodes.saveCodesForUser(user.id, codeHashes);

      repos.auditLog.record({
        action: 'SECURITY_ALERT: ROOT_BREAKGLASS_EXECUTED',
        status: 'ALERT',
        actor_id: user.id,
        username,
        role: 'root',
        caller_tier: 'host_offline_cli',
        details: {
          message: 'Root administrator account reset via host offline CLI',
          timestamp: now
        }
      });
    });

    breakglassTx();

    const otpauthUri = getTotpUri(newTotpSecret, username);
    const qrTerminal = await generateQrTerminalString(otpauthUri);

    console.log('\n=============================================================');
    console.log('  ⚠️  SCATTERID EMERGENCY BREAK-GLASS RECOVERY EXECUTED');
    console.log('=============================================================');
    console.log(`Username:         ${username}`);
    console.log(`Master Password:  ${password}`);
    console.log(`TOTP Secret:      ${newTotpSecret}`);
    console.log('-------------------------------------------------------------');
    console.log('Scan the QR Code below with your mobile authenticator:\n');
    console.log(qrTerminal);
    console.log('-------------------------------------------------------------');
    console.log('Single-Use Emergency Recovery Codes (Save immediately!):');
    rawCodes.forEach((code, idx) => {
      console.log(`  [${idx + 1}]  ${code}`);
    });
    console.log('=============================================================\n');

    return {
      success: true,
      username,
      password,
      totpSecret: newTotpSecret,
      recoveryCodes: rawCodes
    };
  }

  // 2. RESET MFA COMMAND
  if (command === 'reset-mfa' || args['reset-mfa']) {
    const username = args.username;
    if (!username) {
      throw new Error('--username is required for reset-mfa');
    }

    const user = repos.users.findByUsername(username);
    if (!user) {
      throw new Error(`User '${username}' not found`);
    }

    const resetTx = db.transaction(() => {
      repos.users.updateTotp(user.id, { totp_secret: null, totp_enabled: 0 });
      db.prepare('DELETE FROM recovery_codes WHERE user_id = ?').run(user.id);
      repos.auditLog.record({
        action: 'SECURITY_ALERT: MFA_RESET_OFFLINE_CLI',
        status: 'ALERT',
        actor_id: user.id,
        username,
        role: user.role,
        caller_tier: 'host_offline_cli',
        details: { message: `MFA seed and recovery codes purged via host CLI` }
      });
    });

    resetTx();
    console.log(`[ScatterID CLI] MFA enrollment reset successfully for '${username}'.`);
    return { success: true, username, mfaReset: true };
  }

  // 3. RESET PASSWORD COMMAND
  if (command === 'reset-password' || args['reset-password']) {
    const username = args.username;
    const password = args.password;
    if (!username || !password) {
      throw new Error('--username and --password are required');
    }

    const user = repos.users.findByUsername(username);
    if (!user) {
      throw new Error(`User '${username}' not found`);
    }

    const minLength = user.role === 'root' ? 16 : 10;
    if (password.length < minLength) {
      throw new Error(`Password must be at least ${minLength} characters for role '${user.role}'`);
    }

    const pHash = await hashPassword(password);
    repos.users.updatePassword(user.id, pHash, 0);

    repos.auditLog.record({
      action: 'SECURITY_ALERT: PASSWORD_RESET_OFFLINE_CLI',
      status: 'ALERT',
      actor_id: user.id,
      username,
      role: user.role,
      caller_tier: 'host_offline_cli'
    });

    console.log(`[ScatterID CLI] Password reset successfully for '${username}'.`);
    return { success: true, username };
  }

  // 4. EXPORT BACKUP COMMAND
  if (command === 'export-backup' || args['export-backup']) {
    const passphrase = args.passphrase;
    const outPath = args.out || `scatterid_backup_${Date.now()}.enc`;

    if (!passphrase || passphrase.length < 12) {
      throw new Error('--passphrase (minimum 12 chars) is required');
    }

    const keys = repos.pqcKeys.listPool();
    const envelope = exportEncryptedEnvelope({
      masterPassphrase: passphrase,
      keys,
      metadata: { exported_by: 'host_offline_cli' }
    });

    fs.writeFileSync(outPath, envelope, 'utf8');

    repos.auditLog.record({
      action: 'SECURITY_ALERT: PQC_BACKUP_EXPORTED_OFFLINE_CLI',
      status: 'ALERT',
      caller_tier: 'host_offline_cli',
      details: { outPath, keyCount: keys.length }
    });

    console.log(`[ScatterID CLI] Encrypted backup envelope exported to: ${outPath}`);
    return { success: true, outPath, keyCount: keys.length };
  }

  // 5. ROTATE PQC COMMAND
  if (command === 'rotate-pqc' || args['rotate-pqc']) {
    const keyId = args['key-id'];
    const reason = args.reason || 'Emergency rotation via offline CLI';

    let promotedKey;
    if (keyId) {
      promotedKey = repos.pqcKeys.activatePreStagedKey(keyId);
    } else {
      const preStaged = repos.pqcKeys.getPreStagedKeys();
      if (preStaged.length === 0) {
        throw new Error('No pre-staged PQC keys available in pool to promote');
      }
      promotedKey = repos.pqcKeys.activatePreStagedKey(preStaged[0].key_id);
    }

    repos.auditLog.record({
      action: 'SECURITY_ALERT: PQC_ROTATION_OFFLINE_CLI',
      status: 'ALERT',
      caller_tier: 'host_offline_cli',
      details: { key_id: promotedKey.key_id, reason }
    });

    console.log(`[ScatterID CLI] PQC Active key rotated to '${promotedKey.key_id}'.`);
    return { success: true, activeKey: promotedKey };
  }

  // Help menu
  console.log(`
ScatterID Offline Emergency CLI Tool
Usage:
  node tools/admin_cli.js breakglass [--username <admin>] [--password <pass>]
  node tools/admin_cli.js --reset-mfa --username <user>
  node tools/admin_cli.js --reset-password --username <user> --password <pass>
  node tools/admin_cli.js --export-backup --out <file.enc> --passphrase <pass>
  node tools/admin_cli.js --rotate-pqc [--key-id <id>]
`);
  return { help: true };
}

// Direct CLI invocation
if (process.argv[1] === __filename) {
  runCli().catch((err) => {
    console.error('[ScatterID CLI Error]:', err.message);
    process.exit(1);
  });
}
