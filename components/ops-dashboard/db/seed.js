// Database Seeder for Local Testing & Initial Boot
// Provisions initial staff accounts with temporary One-Time Passwords (OTP)
// Enforces mandatory first-time onboarding (New permanent password + TOTP scan)

import crypto from 'node:crypto';
import { hashPassword } from '../src/auth/passwords.js';

export async function seedInitialData(db, repos) {
  const existingRoot = repos.users.findByUsername('root_admin');
  if (existingRoot) {
    return false; // Already seeded
  }

  console.log('[ScatterID Seed] Provisioning initial staff accounts with temporary One-Time Passwords (OTP)...');

  const rootTempOtp = 'TempPass-Root2026!';
  const modTempOtp = 'TempPass-Mod2026!';
  const clerkTempOtp = 'TempPass-Clerk2026!';

  const rootHash = await hashPassword(rootTempOtp);
  const modHash = await hashPassword(modTempOtp);
  const clerkHash = await hashPassword(clerkTempOtp);

  // 1. Root Administrator (Requires first-time setup: permanent pass + TOTP QR)
  const rootUser = repos.users.createUser({
    id: crypto.randomUUID(),
    username: 'root_admin',
    password_hash: rootHash,
    role: 'root',
    totp_secret: null,
    totp_enabled: 0,
    force_password_reset: 1
  });

  // 2. Moderator (Requires first-time setup: permanent pass + TOTP QR)
  const modUser = repos.users.createUser({
    id: crypto.randomUUID(),
    username: 'mod_sarah',
    password_hash: modHash,
    role: 'mod',
    totp_secret: null,
    totp_enabled: 0,
    force_password_reset: 1
  });

  // 3. Help Desk Clerk (Requires first-time setup: permanent pass)
  const clerkUser = repos.users.createUser({
    id: crypto.randomUUID(),
    username: 'clerk_john',
    password_hash: clerkHash,
    role: 'clerk',
    station_id: 'STATION-DESK-01',
    totp_secret: null,
    totp_enabled: 0,
    force_password_reset: 1
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
  console.log('  ScatterID Staff Accounts Provisioned (First-Time Onboarding)');
  console.log('=============================================================');
  console.log('  1. Root Administrator:');
  console.log('     Username: root_admin');
  console.log(`     Temporary One-Time Password: ${rootTempOtp}`);
  console.log('     Status: Must complete first-time setup (New Password + TOTP QR)');
  console.log('  -----------------------------------------------------------');
  console.log('  2. Moderator:');
  console.log('     Username: mod_sarah');
  console.log(`     Temporary One-Time Password: ${modTempOtp}`);
  console.log('     Status: Must complete first-time setup (New Password + TOTP QR)');
  console.log('  -----------------------------------------------------------');
  console.log('  3. Help Desk Clerk:');
  console.log('     Username: clerk_john');
  console.log('     Station ID: STATION-DESK-01');
  console.log(`     Temporary One-Time Password: ${clerkTempOtp}`);
  console.log('     Status: Must complete first-time setup (New Password)');
  console.log('=============================================================');

  return true;
}
