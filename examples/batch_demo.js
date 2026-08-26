#!/usr/bin/env node

/**
 * ScatterID SDK Batch Processing & Verification Showcase
 *
 * This script reads the 10-row sample dataset (credentials_input.json),
 * passes each claim through the ScatterID TypeScript/JavaScript SDK to:
 *   1. Locally canonicalize the claim (RFC 8785 JCS).
 *   2. Generate a 16-byte CSPRNG random salt.
 *   3. Compute the SHA3-256 hash commitment (Zero-Knowledge: raw data stays local).
 *   4. Issue and anchor the credential via the Verification Gateway (ML-DSA-65 signature + Fabric).
 *   5. Perform an offline/online verification check to prove cryptographic authenticity.
 *   6. Simulate tampering to verify that any data modification is rejected.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ScatterIDClient } from '../sdk/dist/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to load .env if present
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
const API_URL = process.env.VERIFICATION_API_URL || 'http://localhost:3000';

if (!API_KEY) {
  console.error('\x1b[31m[ERROR] VERIFICATION_API_KEY is not set in .env or environment.\x1b[0m');
  console.error('Please run ./quickstart.sh to provision keys, or set VERIFICATION_API_KEY.');
  process.exit(1);
}

// 1. Load the 10-row dataset
const inputPath = path.resolve(__dirname, 'credentials_input.json');
const rawData = fs.readFileSync(inputPath, 'utf8');
const credentials = JSON.parse(rawData);

console.log('\x1b[1m\x1b[36m======================================================================\x1b[0m');
console.log('\x1b[1m\x1b[36m   ScatterID SDK — Batch Credential Issuance & Verification Demo      \x1b[0m');
console.log('\x1b[1m\x1b[36m======================================================================\x1b[0m');
console.log(`Loaded ${credentials.length} sample claims from: ${inputPath}\n`);

const client = new ScatterIDClient({
  apiKey: API_KEY,
  issuanceUrl: API_URL,
  verificationUrl: API_URL
});

async function runBatch() {
  const results = [];

  for (let i = 0; i < credentials.length; i++) {
    const claim = credentials[i];
    console.log(`\x1b[1m[${i + 1}/${credentials.length}] Processing Claim:\x1b[0m`);
    console.log(`  Subject: \x1b[33m${claim.subject}\x1b[0m`);
    console.log(`  Role:    \x1b[32m${claim.role}\x1b[0m`);

    try {
      // Step A: Issue Credential via SDK
      // (SDK computes RFC 8785 canonicalization + 16-byte salt + SHA3-256 hash locally)
      const issued = await client.issue(claim);
      console.log(`  -> \x1b[36mComputed dataHash (SHA3-256):\x1b[0m ${issued.dataHash.substring(0, 24)}...`);
      console.log(`  -> \x1b[36mLocal 16-byte Salt:\x1b[0m           ${issued.salt}`);
      console.log(`  -> \x1b[36mPQC Signature (ML-DSA-65):\x1b[0m    ${issued.signature ? issued.signature.substring(0, 24) + '...' : 'Generated'}`);
      console.log(`  -> \x1b[36mCredential ID:\x1b[0m                ${issued.credentialId}`);
      console.log(`  -> \x1b[36mFabric Anchor TxID:\x1b[0m           ${issued.anchorTxId || 'Pending'}`);

      // Step B: Verify the Authentic Credential
      const verifyResult = await client.verifyByClaim(claim, issued.salt, issued.credentialId);
      const isValid = verifyResult.valid;
      console.log(`  -> \x1b[1m\x1b[32mVerification Check:\x1b[0m           ${isValid ? '✓ PASSED (Cryptographically Validated)' : '✕ FAILED'}`);

      // Step C: Tampering Simulation
      // Modify an attribute and ensure verification fails
      const tamperedClaim = { ...claim, role: claim.role + ' (TAMPERED)' };
      const tamperResult = await client.verifyByClaim(tamperedClaim, issued.salt, issued.credentialId);
      console.log(`  -> \x1b[1m\x1b[33mTamper Detection Test:\x1b[0m        ${!tamperResult.valid ? '✓ REJECTED (Tampered data detected)' : '✕ MISSED'}`);

      results.push({
        index: i + 1,
        subject: claim.subject,
        role: claim.role,
        credentialId: issued.credentialId,
        status: issued.status,
        verified: isValid
      });

    } catch (err) {
      console.error(`  \x1b[31m✕ Issuance failed:\x1b[0m ${err.message}`);
      results.push({
        index: i + 1,
        subject: claim.subject,
        role: claim.role,
        error: err.message
      });
    }
    console.log('');
  }

  // Summary Table
  console.log('\x1b[1m\x1b[36m======================================================================\x1b[0m');
  console.log('\x1b[1m\x1b[32m   Batch Execution Complete! Summary Table:                           \x1b[0m');
  console.log('\x1b[1m\x1b[36m======================================================================\x1b[0m');
  console.table(results);
}

runBatch().catch(console.error);
