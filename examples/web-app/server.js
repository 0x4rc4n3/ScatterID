import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ScatterIDClient } from '../../sdk/dist/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.DEMO_PORT || 5050;

// Helper to load .env from root
function loadEnv() {
  const envPath = path.resolve(__dirname, '../../.env');
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

const VERIFICATION_API_KEY = process.env.VERIFICATION_API_KEY || '';
const rawApiUrl = process.env.VERIFICATION_API_URL || 'http://localhost:3000';
const VERIFICATION_API_URL = rawApiUrl.replace('verification-api', 'localhost');

const client = new ScatterIDClient({
  apiKey: VERIFICATION_API_KEY,
  issuanceUrl: VERIFICATION_API_URL,
  verificationUrl: VERIFICATION_API_URL
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 1. Get sample 10-row dataset
app.get('/api/samples', (req, res) => {
  try {
    const samplePath = path.resolve(__dirname, '../credentials_input.json');
    const data = JSON.parse(fs.readFileSync(samplePath, 'utf8'));
    res.json({ success: true, samples: data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Issue a credential via SDK
app.post('/api/issue', async (req, res) => {
  const { claim } = req.body;
  if (!claim || typeof claim !== 'object') {
    return res.status(400).json({ error: 'Claim must be a valid JSON object' });
  }

  try {
    const result = await client.issue(claim);
    res.status(201).json({
      success: true,
      credential: {
        credentialId: result.credentialId,
        dataHash: result.dataHash,
        salt: result.salt,
        algorithm: result.algorithm,
        publicKeyId: result.publicKeyId,
        signature: result.signature,
        anchorTxId: result.anchorTxId,
        status: result.status,
        issuedAt: result.issuedAt,
        rawClaim: claim
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Verify a credential via SDK (by claim + salt)
app.post('/api/verify', async (req, res) => {
  const { claim, salt, credentialId } = req.body;
  if (!claim || !salt) {
    return res.status(400).json({ error: 'Both claim and salt are required for Zero-Knowledge verification' });
  }

  try {
    const result = await client.verifyByClaim(claim, salt, credentialId);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Verify directly by raw hash
app.post('/api/verify-hash', async (req, res) => {
  const { dataHash, credentialId } = req.body;
  if (!dataHash) {
    return res.status(400).json({ error: 'dataHash is required' });
  }

  try {
    const result = await client.verifyByHash(dataHash, credentialId);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Update / Supersede Credential lifecycle demo
app.post('/api/update', async (req, res) => {
  const { oldCredentialId, updatedClaim } = req.body;
  if (!oldCredentialId || !updatedClaim) {
    return res.status(400).json({ error: 'oldCredentialId and updatedClaim are required' });
  }

  try {
    // Step 1: Revoke the prior credential on-chain via SDK
    let revokeResult;
    try {
      revokeResult = await client.revoke(oldCredentialId);
    } catch (revokeErr) {
      return res.status(502).json({
        success: false,
        error: `Failed to revoke prior credential on ledger: ${revokeErr.message}. Supersede aborted.`,
        code: 'REVOKE_FAILED'
      });
    }

    if (!revokeResult || revokeResult.status !== 'revoked') {
      return res.status(502).json({
        success: false,
        error: `Prior credential revocation returned unexpected status (${revokeResult?.status || 'unknown'}). Supersede aborted.`,
        code: 'REVOKE_FAILED'
      });
    }

    // Step 2: Issue replacement credential chained to the revoked ID
    const claimWithChain = {
      ...updatedClaim,
      replacesCredentialId: oldCredentialId,
      supersedesTimestamp: new Date().toISOString()
    };
    const v2Result = await client.issue(claimWithChain);

    res.json({
      success: true,
      message: `Credential superseding complete. Prior credential revoked on ledger and Version 2 issued with ID ${v2Result.credentialId}.`,
      v1: { credentialId: oldCredentialId, status: 'revoked' },
      v2: {
        credentialId: v2Result.credentialId,
        dataHash: v2Result.dataHash,
        salt: v2Result.salt,
        anchorTxId: v2Result.anchorTxId,
        status: v2Result.status,
        rawClaim: claimWithChain
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n======================================================================`);
  console.log(`  ScatterID SDK Visual Web Application running!`);
  console.log(`  URL: http://localhost:${PORT}`);
  console.log(`======================================================================\n`);
});
