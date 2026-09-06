// Database Seeder for Local Testing & Initial Boot
// Creates default demo accounts (Root, Mod, Clerk), PQC Keys, and Gateway Keys

import crypto from 'node:crypto';
import { hashPassword } from '../src/auth/passwords.js';
import {
  generateTotpSecret,
  encryptTotpSecret,
  generateTotpCode
} from '../src/auth/totp.js';
import {
  generateRecoveryCodesBatch,
  hashRecoveryCode
} from '../src/auth/recoveryCodes.js';

export async function seedInitialData(db, repos) {
  const existingRoot = repos.users.findByUsername('root_admin');
  if (existingRoot) {
    return false; // Already seeded
  }

  console.log('[ScatterID Seed] Seeding initial demo staff accounts and cryptographic keys...');

  const defaultPassword = 'ScatterID@Master2026!';
  const passwordHash = await hashPassword(defaultPassword);

  // 1. Root Admin
  const rootTotpSecret = generateTotpSecret();
  const rootEncSecret = encryptTotpSecret(rootTotpSecret);
  const rootUser = repos.users.createUser({
    id: crypto.randomUUID(),
    username: 'root_admin',
    password_hash: passwordHash,
    role: 'root',
    totp_secret: rootEncSecret,
    totp_enabled: 1
  });

  const rootCodes = generateRecoveryCodesBatch(8);
  repos.recoveryCodes.saveCodesForUser(rootUser.id, rootCodes.map(c => hashRecoveryCode(c)));

  // 2. Moderator
  const modTotpSecret = generateTotpSecret();
  const modEncSecret = encryptTotpSecret(modTotpSecret);
  const modUser = repos.users.createUser({
    id: crypto.randomUUID(),
    username: 'mod_sarah',
    password_hash: passwordHash,
    role: 'mod',
    totp_secret: modEncSecret,
    totp_enabled: 1
  });

  const modCodes = generateRecoveryCodesBatch(8);
  repos.recoveryCodes.saveCodesForUser(modUser.id, modCodes.map(c => hashRecoveryCode(c)));

  // 3. Help Desk Clerk
  const clerkUser = repos.users.createUser({
    id: crypto.randomUUID(),
    username: 'clerk_john',
    password_hash: passwordHash,
    role: 'clerk',
    station_id: 'STATION-DESK-01',
    totp_secret: null,
    totp_enabled: 0
  });

  // 4. Pre-staged PQC Keys
  const activePubHex = '0123456789abcdef'.repeat(16);
  const preStagedPubHex = 'fedcba9876543210'.repeat(16);

  repos.pqcKeys.addKeyToPool({
    key_id: 'pqc-mldsa87-prod-v1',
    algorithm: 'ML-DSA-87',
    public_key_hex: activePubHex,
    public_key_id_sha3: crypto.createHash('sha3-256').update(activePubHex).digest('hex'),
    status: 'active',
    sequence_number: 1
  });

  repos.pqcKeys.addKeyToPool({
    key_id: 'pqc-mldsa87-prod-v2',
    algorithm: 'ML-DSA-87',
    public_key_hex: preStagedPubHex,
    public_key_id_sha3: crypto.createHash('sha3-256').update(preStagedPubHex).digest('hex'),
    status: 'pre_staged',
    sequence_number: 2
  });

  // 5. Active Gateway Key (Must be 'VERIFICATION_API_KEY' or 'REVOKE_API_KEY')
  repos.gatewayKeys.rotateKey({
    id: crypto.randomUUID(),
    key_name: 'VERIFICATION_API_KEY',
    key_hash: crypto.createHash('sha256').update('initial-verification-api-key').digest('hex'),
    graceWindowHours: 48,
    created_by: rootUser.id
  });

  console.log('=============================================================');
  console.log('  ScatterID Local Demo Accounts Seeded Successfully');
  console.log('=============================================================');
  console.log(`  Password for all accounts: ${defaultPassword}`);
  console.log('  -----------------------------------------------------------');
  console.log('  1. Root Admin:');
  console.log('     Username: root_admin');
  console.log(`     TOTP Secret: ${rootTotpSecret}`);
  console.log(`     Current TOTP Code: ${generateTotpCode(rootTotpSecret)}`);
  console.log(`     Sample Recovery Code: ${rootCodes[0]}`);
  console.log('  -----------------------------------------------------------');
  console.log('  2. Moderator:');
  console.log('     Username: mod_sarah');
  console.log(`     TOTP Secret: ${modTotpSecret}`);
  console.log(`     Current TOTP Code: ${generateTotpCode(modTotpSecret)}`);
  console.log(`     Sample Recovery Code: ${modCodes[0]}`);
  console.log('  -----------------------------------------------------------');
  console.log('  3. Help Desk Clerk:');
  console.log('     Username: clerk_john');
  console.log('     Station ID: STATION-DESK-01');
  console.log('     MFA: Not required for clerk intake');
  console.log('=============================================================');

  return true;
}
