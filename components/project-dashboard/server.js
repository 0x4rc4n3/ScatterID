import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import fsSync from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import net from 'net';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

const VERIFICATION_API_URL = process.env.VERIFICATION_API_URL || 'http://verification-api:3000';
const CRYPTO_SERVICE_URL = process.env.CRYPTO_SERVICE_URL || 'https://crypto-service:5001';
const CRYPTO_SERVICE_API_KEY = process.env.CRYPTO_SERVICE_API_KEY || '';
const CRYPTO_SERVICE_HOST = process.env.CRYPTO_SERVICE_HOST || 'crypto-service';
const VERIFICATION_API_HOST = process.env.VERIFICATION_API_HOST || 'verification-api';
const GATEWAY_API_KEY = process.env.GATEWAY_API_KEY || '';
const VERIFICATION_API_KEY = process.env.VERIFICATION_API_KEY || '';

// Fail fast if dashboard authentication is not configured.
if (!GATEWAY_API_KEY || GATEWAY_API_KEY === 'disabled') {
  console.error('FATAL: GATEWAY_API_KEY must be set. The dashboard cannot start without authentication.');
  process.exit(1);
}

// Returns headers for calls the dashboard makes to verification-api.
// Includes the Bearer token so verification-api's inbound auth check passes.
function getVerificationApiHeaders() {
  return {
    'Content-Type': 'application/json',
    ...(VERIFICATION_API_KEY ? { 'Authorization': `Bearer ${VERIFICATION_API_KEY}` } : {})
  };
}

// Returns headers for calls the dashboard makes to crypto-service.
function getCryptoServiceHeaders() {
  return {
    'Content-Type': 'application/json',
    ...(CRYPTO_SERVICE_API_KEY ? { 'Authorization': `Bearer ${CRYPTO_SERVICE_API_KEY}` } : {})
  };
}

app.use(express.json());
app.use(helmet());

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later', code: 'RATE_LIMITED' }
});

app.use('/api/', apiLimiter);

// Static files and demo page — no auth required (serves the frontend)
app.use(express.static(path.join(__dirname, 'public')));

app.get('/healthz', (req, res) => {
  res.json({ status: 'ok', service: 'project-dashboard' });
});

app.get('/demo', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/demo.html'));
});

// ---------------------------------------------------------------------------
// Inbound authentication middleware for all /api/* routes.
//
// Both the supplied token and the expected key are hashed with SHA-256 before
// comparison. This produces a fixed-length digest regardless of the input
// length, eliminating the length-oracle side-channel that would exist if we
// compared raw buffers and short-circuited on a length mismatch first.
// ---------------------------------------------------------------------------
app.use('/api', (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.slice(7);
  const tokenHash = createHash('sha256').update(token).digest();
  const keyHash   = createHash('sha256').update(GATEWAY_API_KEY).digest();

  if (!timingSafeEqual(tokenHash, keyHash)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
});

// Helper to check if a port/host is reachable
function checkPort(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1500);
    socket.on('connect', () => { socket.destroy(); resolve(true); });
    socket.on('timeout', () => { socket.destroy(); resolve(false); });
    socket.on('error',   () => { socket.destroy(); resolve(false); });
    socket.connect(port, host);
  });
}

// ---------------------------------------------------------------------------
// /api/verify — proxy to verification-api
// ---------------------------------------------------------------------------
app.post('/api/verify', async (req, res) => {
  const { credentialId } = req.body;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!credentialId || !uuidRegex.test(credentialId)) {
    return res.status(400).json({ error: 'Invalid parameter: credentialId must be a valid UUID v4' });
  }

  try {
    const response = await fetch(`${VERIFICATION_API_URL}/verify`, {
      method: 'POST',
      headers: getVerificationApiHeaders(),
      body: JSON.stringify({ credentialId }),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error('Failed to proxy verify route:', err.stack || err.message);
    res.status(500).json({ error: 'Verification API is unreachable' });
  }
});

// ---------------------------------------------------------------------------
// /api/status — system health check via port probes
// ---------------------------------------------------------------------------
app.get('/api/status', async (req, res) => {
  const cryptoServiceUp    = await checkPort(5001, CRYPTO_SERVICE_HOST) || await checkPort(5001, '127.0.0.1');
  const verificationApiUp  = await checkPort(3000, VERIFICATION_API_HOST) || await checkPort(3000, '127.0.0.1');
  const ordererUp          = await checkPort(7050, 'orderer.scatterid.com') || await checkPort(7050, '127.0.0.1');
  const issuerPeerUp       = await checkPort(7051, 'peer0.issuer.scatterid.com') || await checkPort(7051, '127.0.0.1');
  const verifierPeerUp     = await checkPort(8051, 'peer0.verifier.scatterid.com') || await checkPort(8051, '127.0.0.1');

  res.json({
    services: {
      cryptoService: cryptoServiceUp ? 'RUNNING' : 'STOPPED',
      verificationApi: verificationApiUp ? 'RUNNING' : 'STOPPED'
    },
    blockchain: {
      orderer: ordererUp ? 'RUNNING' : 'OFFLINE',
      issuerPeer: issuerPeerUp ? 'RUNNING' : 'OFFLINE',
      verifierPeer: verifierPeerUp ? 'RUNNING' : 'OFFLINE'
    }
  });
});

// ---------------------------------------------------------------------------
// /api/credentials — proxy list from verification-api
// ---------------------------------------------------------------------------
app.get('/api/credentials', async (req, res) => {
  try {
    const response = await fetch(`${VERIFICATION_API_URL}/credentials`, {
      headers: getVerificationApiHeaders(),
      signal: AbortSignal.timeout(5000)
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Failed to proxy credentials list query:', err.stack || err.message);
    res.json({ success: false, error: 'Verification API unreachable', credentials: [] });
  }
});

// ---------------------------------------------------------------------------
// /api/issue — demo issuance endpoint.
//
// The zero-knowledge design requires that raw claim data never reaches the
// verification-api — only a SHA3-256 hash commitment may be forwarded.
// This endpoint hashes the claim server-side (in the dashboard process) and
// forwards only { dataHash } to verification-api, preserving that invariant.
//
// NOTE: In production flows callers should hash client-side via the SDK so
// that the raw claim is never transmitted over any network boundary at all.
// This dashboard path is a convenience for the operator demo only.
// ---------------------------------------------------------------------------
app.post('/api/issue', async (req, res) => {
  const { claim, dataHash: precomputedHash } = req.body;

  let dataHash;

  if (precomputedHash) {
    // Caller already hashed via the SDK — validate format and forward directly.
    if (!/^[0-9a-fA-F]{64}$/.test(precomputedHash)) {
      return res.status(400).json({ error: 'Invalid dataHash: must be a 64-character hex string' });
    }
    dataHash = precomputedHash;
  } else if (claim && typeof claim === 'object') {
    // Dashboard demo: hash the claim server-side. Raw claim data goes no further
    // than this process — only the hash is forwarded to verification-api.
    // Uses SHA-256 for simplicity here; production clients should use the SDK
    // (SHA3-256 + CSPRNG salt for unlinkable commitments).
    const canonical = JSON.stringify(claim, Object.keys(claim).sort());
    dataHash = createHash('sha256').update(canonical).digest('hex');
  } else {
    return res.status(400).json({
      error: 'Request must include either a "claim" object or a pre-computed "dataHash" string'
    });
  }

  const idempotencyKey = `dashboard-${createHash('sha256').update(dataHash).digest('hex').slice(0, 16)}`;

  try {
    const response = await fetch(`${VERIFICATION_API_URL}/issue`, {
      method: 'POST',
      headers: getVerificationApiHeaders(),
      body: JSON.stringify({ dataHash, idempotencyKey }),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error('Failed to proxy issue route:', err.stack || err.message);
    res.status(500).json({ error: 'Verification API unreachable' });
  }
});

// ---------------------------------------------------------------------------
// /api/credentials/:id — single credential detail
// ---------------------------------------------------------------------------
app.get('/api/credentials/:id', async (req, res) => {
  const { id } = req.params;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!id || !uuidRegex.test(id)) {
    return res.status(400).json({ success: false, error: 'Invalid parameter: id must be a valid UUID v4' });
  }

  try {
    const response = await fetch(`${VERIFICATION_API_URL}/status/${id}`, {
      headers: getVerificationApiHeaders(),
      signal: AbortSignal.timeout(5000)
    });
    const data = await response.json();
    res.json({ success: true, credential: data });
  } catch (err) {
    console.error('Failed to fetch credential detail:', err.stack || err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// ---------------------------------------------------------------------------
// /api/diagnostics/run — E2E smoke test
// ---------------------------------------------------------------------------
app.post('/api/diagnostics/run', async (req, res) => {
  const logs = [];
  const addLog = (step, detail, status = 'info') => {
    logs.push({ timestamp: new Date().toISOString(), step, detail, status });
  };

  try {
    addLog('Start', 'Initiating E2E Diagnostics Smoke Test', 'info');

    const apiUp = await checkPort(3000, VERIFICATION_API_HOST) || await checkPort(3000, '127.0.0.1');
    if (!apiUp) {
      addLog('Verification API Check', 'Verification API is offline on port 3000', 'error');
      return res.json({ success: false, logs });
    }
    addLog('Verification API Check', 'Verification API is active on port 3000', 'success');

    const cryptoUp = await checkPort(5001, CRYPTO_SERVICE_HOST) || await checkPort(5001, '127.0.0.1');
    if (!cryptoUp) {
      addLog('Crypto Service Check', 'Crypto Service is offline on port 5001', 'error');
      return res.json({ success: false, logs });
    }
    addLog('Crypto Service Check', 'Crypto Service is active on port 5001', 'success');

    // Hash the claim here so verification-api only ever sees a dataHash.
    const claim = {
      subject: 'Diagnostic Test User',
      role: 'Master of Science in Cybersecurity',
      timestamp: new Date().toISOString()
    };
    const canonical = JSON.stringify(claim, Object.keys(claim).sort());
    const dataHash = createHash('sha256').update(canonical).digest('hex');

    addLog('Credential Issuance', `Sending POST to ${VERIFICATION_API_URL}/issue`, 'info');
    const issueResponse = await fetch(`${VERIFICATION_API_URL}/issue`, {
      method: 'POST',
      headers: getVerificationApiHeaders(),
      body: JSON.stringify({ dataHash })
    });

    if (!issueResponse.ok) {
      const errText = await issueResponse.text();
      addLog('Credential Issuance', `API rejected issuance: ${errText}`, 'error');
      return res.json({ success: false, logs });
    }

    const issueResult = await issueResponse.json();
    addLog('Credential Issuance', `Issued. ID: ${issueResult.credentialId}. TxID: ${issueResult.anchorTxId || 'Pending'}`, 'success');

    const credId = issueResult.credentialId;
    addLog('Credential Verification', `Sending POST to ${VERIFICATION_API_URL}/verify`, 'info');
    const verifyResponse = await fetch(`${VERIFICATION_API_URL}/verify`, {
      method: 'POST',
      headers: getVerificationApiHeaders(),
      body: JSON.stringify({ dataHash, credentialId: credId })
    });

    if (!verifyResponse.ok) {
      const errText = await verifyResponse.text();
      addLog('Credential Verification', `API rejected verification: ${errText}`, 'error');
      return res.json({ success: false, logs });
    }

    const verifyResult = await verifyResponse.json();
    if (verifyResult.valid) {
      addLog('Credential Verification', `Verification SUCCEEDED. Anchor: ${verifyResult.anchorStatus}`, 'success');
    } else {
      addLog('Credential Verification', `Verification FAILED. Reason: ${verifyResult.reason || 'Unknown'}`, 'error');
    }

    res.json({ success: true, logs });
  } catch (err) {
    addLog('Exception', `Unexpected error during smoke test: ${err.message}`, 'error');
    res.json({ success: false, logs });
  }
});

// ---------------------------------------------------------------------------
// /api/logs/:container — Docker socket access was removed for security.
// ---------------------------------------------------------------------------
app.get('/api/logs/:container', (req, res) => {
  res.json({
    success: true,
    content: 'Container log streaming requires direct Docker access. Use `docker logs <container>` from the host.'
  });
});

// ---------------------------------------------------------------------------
// /api/settings
// ---------------------------------------------------------------------------
app.get('/api/settings', (req, res) => {
  res.status(204).end();
});

// ---------------------------------------------------------------------------
// /api/settings/rotate — proxies to crypto-service POST /rotate.
//
// The previous implementation targeted verification-api's /rotate-key which
// does not exist. Key rotation is an operation on the KMS (crypto-service),
// not the gateway.
// ---------------------------------------------------------------------------
app.post('/api/settings/rotate', async (req, res) => {
  if (!CRYPTO_SERVICE_URL || !CRYPTO_SERVICE_API_KEY) {
    return res.status(503).json({
      success: false,
      error: 'CRYPTO_SERVICE_URL or CRYPTO_SERVICE_API_KEY is not configured on the dashboard.'
    });
  }

  try {
    const response = await fetch(`${CRYPTO_SERVICE_URL}/rotate`, {
      method: 'POST',
      headers: getCryptoServiceHeaders(),
      body: JSON.stringify({})
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ success: false, error: errText });
    }

    const data = await response.json();
    console.log('[Dashboard] Key rotation triggered via crypto-service.');
    res.json(data);
  } catch (err) {
    console.error('Failed to proxy key rotation to crypto-service:', err.stack || err.message);
    res.status(500).json({ success: false, error: 'Crypto service unreachable' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`ScatterID Project Dashboard running at http://0.0.0.0:${PORT}`);
});
