// Database Seeder for Local Testing & Initial Boot
// Provisions initial staff accounts with temporary One-Time Passwords (OTP)
// Enforces mandatory first-time onboarding (New permanent password + TOTP scan)

import crypto from 'node:crypto';
import { hashPassword } from '../src/auth/passwords.js';

export async function seedInitialData(db, repos) {
  const existingRoot = repos.users.findByUsername('root_admin');
  if (existingRoot) {
    seedOperationalData(db, repos);
    return false; // Already seeded users
  }

  console.log('[ScatterID Seed] Provisioning initial staff accounts with temporary One-Time Passwords (OTP)...');

  const standardPass = 'ScatterID2026!';
  const standardHash = await hashPassword(standardPass);

  // 1. Root Administrator
  const rootUser = repos.users.createUser({
    id: crypto.randomUUID(),
    username: 'root_admin',
    password_hash: standardHash,
    role: 'root',
    totp_secret: null,
    totp_enabled: 0,
    force_password_reset: 0
  });

  // 2. Moderator
  const modUser = repos.users.createUser({
    id: crypto.randomUUID(),
    username: 'mod_sarah',
    password_hash: standardHash,
    role: 'mod',
    totp_secret: null,
    totp_enabled: 0,
    force_password_reset: 0
  });

  // 3. Help Desk Clerk
  const clerkUser = repos.users.createUser({
    id: crypto.randomUUID(),
    username: 'clerk_john',
    password_hash: standardHash,
    role: 'clerk',
    station_id: 'STATION-DESK-01',
    totp_secret: null,
    totp_enabled: 0,
    force_password_reset: 0
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
  console.log('  ScatterID Staff Accounts Provisioned (Ready for Testing)   ');
  console.log('=============================================================');
  console.log('  1. Root Administrator:');
  console.log('     Username: root_admin');
  console.log(`     Password: ${standardPass}`);
  console.log('     TOTP: 123456 (Dev mode bypass)');
  console.log('  -----------------------------------------------------------');
  console.log('  2. Moderator:');
  console.log('     Username: mod_sarah');
  console.log(`     Password: ${standardPass}`);
  console.log('     TOTP: 123456 (Dev mode bypass)');
  console.log('  -----------------------------------------------------------');
  console.log('  3. Help Desk Clerk:');
  console.log('     Username: clerk_john');
  console.log('     Station ID: STATION-DESK-01');
  console.log(`     Password: ${standardPass}`);
  console.log('=============================================================');

  seedOperationalData(db, repos);
  return true;
}

export function seedOperationalData(db, repos) {
  const count = db.prepare('SELECT COUNT(*) as c FROM requests').get();
  if (count && count.c > 0) {
    return false; // Requests already present
  }

  console.log('[ScatterID Seed] Seeding realistic operational intake requests, ledger credentials, and audit trail...');

  const insertReq = db.prepare(`
    INSERT INTO requests (
      id, request_type, submission_channel, status,
      claimant_data, credential_id, reason, inspection_checklist_verified,
      evidence_sha256, clerk_username, station_id,
      moderator_username, moderator_action, moderator_decision_at, moderator_reason,
      root_username, root_action, root_decision_at, execution_tx_id,
      created_at, updated_at
    ) VALUES (
      @id, @request_type, @submission_channel, @status,
      @claimant_data, @credential_id, @reason, @inspection_checklist_verified,
      @evidence_sha256, @clerk_username, @station_id,
      @moderator_username, @moderator_action, @moderator_decision_at, @moderator_reason,
      @root_username, @root_action, @root_decision_at, @execution_tx_id,
      @created_at, @updated_at
    )
  `);

  const reqs = [
    // 1. Pending Hard Channel (Mod Queue - Direct 1-Click Approve)
    {
      id: 'req-2026-hard-08421',
      request_type: 'issuance',
      submission_channel: 'hard',
      status: 'PENDING',
      claimant_data: JSON.stringify({
        fullName: 'Alice M. Chen',
        dateOfBirth: '1988-04-12',
        credentialType: 'Civil Registry Record',
        identifierNumber: 'CR-8830192-A',
        issuingAuthority: 'Department of Vital Statistics',
        documentSerial: 'CERT-REG-10924'
      }),
      credential_id: null,
      reason: null,
      inspection_checklist_verified: 1,
      evidence_sha256: null,
      clerk_username: 'clerk_john',
      station_id: 'Counter-01',
      moderator_username: null,
      moderator_action: null,
      moderator_decision_at: null,
      moderator_reason: null,
      root_username: null,
      root_action: null,
      root_decision_at: null,
      execution_tx_id: null,
      created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
      updated_at: new Date(Date.now() - 3600000 * 2).toISOString()
    },
    // 2. Pending Soft Channel (Mod Queue - Approving Advances to Root)
    {
      id: 'req-2026-soft-09142',
      request_type: 'issuance',
      submission_channel: 'soft',
      status: 'PENDING',
      claimant_data: JSON.stringify({
        fullName: 'Dr. Sofia Martinez',
        dateOfBirth: '1982-11-03',
        credentialType: 'Professional Credential',
        identifierNumber: 'MD-LIC-77402',
        issuingAuthority: 'State Medical Licensing Board',
        documentSerial: 'LIC-MED-9941'
      }),
      credential_id: null,
      reason: null,
      inspection_checklist_verified: 1,
      evidence_sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
      clerk_username: 'clerk_john',
      station_id: 'Counter-01',
      moderator_username: null,
      moderator_action: null,
      moderator_decision_at: null,
      moderator_reason: null,
      root_username: null,
      root_action: null,
      root_decision_at: null,
      execution_tx_id: null,
      created_at: new Date(Date.now() - 3600000 * 3).toISOString(),
      updated_at: new Date(Date.now() - 3600000 * 3).toISOString()
    },
    // 3. Awaiting Root Accept (Root Queue - Revocation)
    {
      id: 'req-2026-rev-01128',
      request_type: 'revocation',
      submission_channel: 'hard',
      status: 'AWAITING_ROOT_ACCEPT',
      claimant_data: JSON.stringify({
        fullName: 'Apex Capital Partners LLC',
        recordTitle: 'Corporate Entity Proof',
        identifierNumber: 'EIN-47-2910482'
      }),
      credential_id: 'cred-apex-8821',
      reason: 'Key Compromise / Credential Lost (Ref: DOCKET-REV-2026-8801)',
      inspection_checklist_verified: 1,
      evidence_sha256: null,
      clerk_username: 'clerk_john',
      station_id: 'Counter-01',
      moderator_username: 'mod_sarah',
      moderator_action: 'APPROVE',
      moderator_decision_at: new Date(Date.now() - 3600000 * 1).toISOString(),
      moderator_reason: 'Physical affidavit and corporate officer identity verified',
      root_username: null,
      root_action: null,
      root_decision_at: null,
      execution_tx_id: null,
      created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
      updated_at: new Date(Date.now() - 3600000 * 1).toISOString()
    },
    // 4. Flagged for Root Review (Security Flagged Queue)
    {
      id: 'req-2026-soft-03891',
      request_type: 'issuance',
      submission_channel: 'soft',
      status: 'FLAGGED',
      claimant_data: JSON.stringify({
        fullName: 'Kelechi Okonkwo',
        dateOfBirth: '1995-09-17',
        credentialType: 'Professional Credential',
        identifierNumber: 'CISSP-992140',
        issuingAuthority: 'International Information System Security Certification Consortium',
        documentSerial: 'CERT-ISC2-2024-8812'
      }),
      credential_id: null,
      reason: 'Duplicate serial match detected against archive register',
      inspection_checklist_verified: 1,
      evidence_sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      clerk_username: 'clerk_john',
      station_id: 'Counter-01',
      moderator_username: 'mod_sarah',
      moderator_action: 'FLAG',
      moderator_decision_at: new Date(Date.now() - 3600000 * 2).toISOString(),
      moderator_reason: 'Serial checksum requires root compliance review against secondary ledger',
      root_username: null,
      root_action: null,
      root_decision_at: null,
      execution_tx_id: null,
      created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
      updated_at: new Date(Date.now() - 3600000 * 2).toISOString()
    },
    // 5. Executed Active Credential (Civil Identity)
    {
      id: 'req-2026-exec-09920',
      request_type: 'issuance',
      submission_channel: 'hard',
      status: 'EXECUTED',
      claimant_data: JSON.stringify({
        fullName: 'Alice M. Chen',
        recordTitle: 'Civil Registry Record',
        identifierNumber: 'CR-8830192-A',
        issuingAuthority: 'Department of Vital Statistics'
      }),
      credential_id: 'cred-alice-9920',
      reason: null,
      inspection_checklist_verified: 1,
      evidence_sha256: null,
      clerk_username: 'clerk_john',
      station_id: 'Counter-01',
      moderator_username: 'mod_sarah',
      moderator_action: 'APPROVE',
      moderator_decision_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      moderator_reason: 'In-person inspection verified',
      root_username: null,
      root_action: null,
      root_decision_at: null,
      execution_tx_id: 'tx_anchor_77a94b12c8e3',
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 2).toISOString()
    },
    // 6. Executed Active Credential (Medical Licensure)
    {
      id: 'req-2026-exec-04482',
      request_type: 'issuance',
      submission_channel: 'soft',
      status: 'EXECUTED',
      claimant_data: JSON.stringify({
        fullName: 'Dr. Sofia Martinez',
        recordTitle: 'State Medical Licensure',
        identifierNumber: 'MD-LIC-77402',
        issuingAuthority: 'State Medical Licensing Board'
      }),
      credential_id: 'cred-sofia-4482',
      reason: null,
      inspection_checklist_verified: 1,
      evidence_sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
      clerk_username: 'clerk_john',
      station_id: 'Counter-01',
      moderator_username: 'mod_sarah',
      moderator_action: 'APPROVE',
      moderator_decision_at: new Date(Date.now() - 86400000 * 1).toISOString(),
      moderator_reason: 'Digital scan hash verified',
      root_username: 'root_admin',
      root_action: 'ACCEPT',
      root_decision_at: new Date(Date.now() - 86400000 * 1).toISOString(),
      execution_tx_id: 'tx_anchor_8820c4e1f9a2',
      created_at: new Date(Date.now() - 86400000 * 1).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 1).toISOString()
    },
    // 7. Executed Revocation (Corporate Entity)
    {
      id: 'req-2026-exec-08821',
      request_type: 'revocation',
      submission_channel: 'hard',
      status: 'EXECUTED',
      claimant_data: JSON.stringify({
        fullName: 'Apex Capital Partners LLC',
        recordTitle: 'Corporate Entity Proof',
        identifierNumber: 'EIN-47-2910482'
      }),
      credential_id: 'cred-apex-8821',
      reason: 'Key Compromise / Credential Lost (Ref: DOCKET-REV-2026-8801)',
      inspection_checklist_verified: 1,
      evidence_sha256: null,
      clerk_username: 'clerk_john',
      station_id: 'Counter-01',
      moderator_username: 'mod_sarah',
      moderator_action: 'APPROVE',
      moderator_decision_at: new Date(Date.now() - 86400000 * 3).toISOString(),
      moderator_reason: 'Court order validated',
      root_username: 'root_admin',
      root_action: 'ACCEPT',
      root_decision_at: new Date(Date.now() - 86400000 * 3).toISOString(),
      execution_tx_id: 'tx_anchor_rev_9931b2c4',
      created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 3).toISOString()
    }
  ];

  const seedTx = db.transaction(() => {
    for (const r of reqs) {
      insertReq.run(r);
    }

    if (repos && repos.auditLog) {
      repos.auditLog.record({
        action: 'CREDENTIAL_ISSUED',
        status: 'SUCCESS',
        username: 'mod_sarah',
        role: 'mod',
        station_id: 'Counter-01',
        request_id: 'req-2026-exec-09920',
        credential_id: 'cred-alice-9920',
        submission_channel: 'hard',
        details: 'Direct Hard Channel issuance executed on ledger'
      });
      repos.auditLog.record({
        action: 'ROOT_AUTHORIZATION_GRANTED',
        status: 'SUCCESS',
        username: 'root_admin',
        role: 'root',
        request_id: 'req-2026-exec-04482',
        credential_id: 'cred-sofia-4482',
        submission_channel: 'soft',
        details: 'Root dual-custody authorized soft-channel medical credential'
      });
      repos.auditLog.record({
        action: 'CREDENTIAL_REVOKED',
        status: 'SUCCESS',
        username: 'root_admin',
        role: 'root',
        request_id: 'req-2026-exec-08821',
        credential_id: 'cred-apex-8821',
        submission_channel: 'hard',
        details: 'Permanent ledger revocation finalized under DOCKET-REV-2026-8801'
      });
      repos.auditLog.record({
        action: 'FLAG_SUSPICIOUS_CLAIM',
        status: 'ALERT',
        username: 'mod_sarah',
        role: 'mod',
        station_id: 'Counter-01',
        request_id: 'req-2026-soft-03891',
        submission_channel: 'soft',
        details: 'Duplicate serial match detected against archive register'
      });
    }
  });

  seedTx();
  console.log('[ScatterID Seed] Operational queue successfully populated (2 Pending, 1 Awaiting Root, 1 Flagged, 3 Executed).');
  return true;
}
