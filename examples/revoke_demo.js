#!/usr/bin/env node

/**
 * ScatterID SDK — Credential Revocation Lifecycle Showcase
 *
 * Demonstrates the proper end-to-end revocation channel:
 *   1. Client SDK issues and anchors a verifiable claim.
 *   2. Client SDK verifies the active on-chain proof.
 *   3. Client SDK triggers revocation:
 *      SDK (client.revoke) → Gateway API (POST /revoke) → Hyperledger Fabric (RevokeProof chaincode)
 *   4. Client SDK verifies that subsequent verification is rejected due to on-chain revocation.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ScatterIDClient, RevokedCredentialError } from '../sdk/dist/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to load .env
function loadEnv() {
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [k, ...v] = trimmed.split('=');
        if (!process.env[k]) {
          process.env[k] = v.join('=');
        }
      }
    }
  }
}

loadEnv();

const API_KEY = process.env.VERIFICATION_API_KEY;
const rawApiUrl = process.env.VERIFICATION_API_URL || 'http://localhost:3000';
const API_URL = rawApiUrl.replace('verification-api', 'localhost');

if (!API_KEY) {
  console.error('\x1b[31m[ERROR] VERIFICATION_API_KEY is not set in .env or environment.\x1b[0m');
  process.exit(1);
}

console.log('\x1b[1m\x1b[36m======================================================================\x1b[0m');
console.log('\x1b[1m\x1b[36m   ScatterID SDK — End-to-End On-Chain Revocation Lifecycle Demo      \x1b[0m');
console.log('\x1b[1m\x1b[36m======================================================================\x1b[0m');

async function run() {
  // 1. Initialize official SDK Client
  const client = new ScatterIDClient({
    apiKey: API_KEY,
    issuanceUrl: API_URL,
    verificationUrl: API_URL
  });

  const claim = {
    subject: "did:scatterid:user:dr-elena-rostova-8821",
    role: "Chief Medical Officer",
    institution: "St. Jude Biomedical Research Institute",
    issuedAt: "2026-08-30"
  };

  console.log('\n\x1b[1m[1/4] Issuing & Anchoring Credential via SDK...\x1b[0m');
  const issued = await client.issue(claim);
  console.log(`  ✓ Credential ID: \x1b[32m${issued.credentialId}\x1b[0m`);
  console.log(`  ✓ Algorithm:     \x1b[34m${issued.algorithm}\x1b[0m`);
  console.log(`  ✓ Hash Anchor:   \x1b[35m${issued.dataHash.slice(0, 24)}...\x1b[0m`);
  console.log(`  ✓ Ledger TxID:   \x1b[33m${issued.anchorTxId || 'Pending'}\x1b[0m`);

  console.log('\n\x1b[1m[2/4] Verifying Active Proof (Before Revocation)...\x1b[0m');
  const verify1 = await client.verifyByClaim(claim, issued.salt, issued.credentialId);
  console.log(`  ✓ Valid:         \x1b[32m${verify1.valid}\x1b[0m`);
  console.log(`  ✓ Anchor Status: \x1b[32m${verify1.anchorStatus}\x1b[0m`);

  console.log('\n\x1b[1m[3/4] Revoking Credential via SDK (SDK → Gateway → Fabric Chaincode)...\x1b[0m');
  const revokeResult = await client.revoke(issued.credentialId);
  console.log(`  ✓ Revoke Status: \x1b[31m${revokeResult.status}\x1b[0m`);
  console.log(`  ✓ Message:       ${revokeResult.message}`);

  console.log('\n\x1b[1m[4/4] Verifying Proof (After Revocation)...\x1b[0m');
  try {
    const verify2 = await client.verifyByClaim(claim, issued.salt, issued.credentialId);
    if (!verify2.valid) {
      console.log(`  ✓ Verification Correctly Rejected: \x1b[31m${verify2.anchorStatus}\x1b[0m`);
      console.log(`  ✓ Reason: ${verify2.reason}`);
    } else {
      console.error('  ✕ Warning: Credential was not rejected!');
    }
  } catch (err) {
    if (err instanceof RevokedCredentialError) {
      console.log(`  ✓ SDK Caught Revoked Credential: \x1b[31m${err.message}\x1b[0m (Code: ${err.code})`);
    } else {
      console.log(`  ✓ Rejected: ${err.message}`);
    }
  }

  console.log('\n\x1b[1m\x1b[32m======================================================================\x1b[0m');
  console.log('\x1b[1m\x1b[32m   ✓ Full Revocation Lifecycle Completed Successfully!               \x1b[0m');
  console.log('\x1b[1m\x1b[32m======================================================================\x1b[0m\n');
}

run().catch((err) => {
  console.error('\x1b[31m[ERROR]\x1b[0m', err);
  process.exit(1);
});
