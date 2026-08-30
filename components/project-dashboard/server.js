import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createHash, timingSafeEqual } from 'crypto';
import fsSync from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import net from 'net';
import { ScatterIDClient } from '../../sdk/dist/index.js';

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
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later', code: 'RATE_LIMITED' }
});

app.use('/api/', apiLimiter);

// Static files and demo page
app.use(express.static(path.join(__dirname, 'public')));

app.get('/healthz', (req, res) => {
  res.json({ status: 'ok', service: 'project-dashboard' });
});

app.get('/demo', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/demo.html'));
});

// ---------------------------------------------------------------------------
// Inbound authentication middleware for all /api/* routes.
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
  const { credentialId, dataHash } = req.body;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  
  const payload = {};
  if (credentialId) {
    if (!uuidRegex.test(credentialId)) {
      return res.status(400).json({ error: 'Invalid parameter: credentialId must be a valid UUID v4' });
    }
    payload.credentialId = credentialId;
  }
  if (dataHash) {
    payload.dataHash = dataHash;
  }
  if (!credentialId && !dataHash) {
    return res.status(400).json({ error: 'Invalid parameter: either credentialId or dataHash is required' });
  }

  try {
    const response = await fetch(`${VERIFICATION_API_URL}/verify`, {
      method: 'POST',
      headers: getVerificationApiHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error('Failed to proxy verify route:', err.stack || err.message);
    res.status(500).json({ error: 'Verification API is unreachable' });
  }
});

// ---------------------------------------------------------------------------
// /api/status — system health check + reconciliation status
// ---------------------------------------------------------------------------
app.get('/api/status', async (req, res) => {
  const cryptoServiceUp    = await checkPort(5001, CRYPTO_SERVICE_HOST) || await checkPort(5001, '127.0.0.1');
  const verificationApiUp  = await checkPort(3000, VERIFICATION_API_HOST) || await checkPort(3000, '127.0.0.1');
  const ordererUp          = await checkPort(7050, 'orderer.scatterid.com') || await checkPort(7050, '127.0.0.1');
  const issuerPeerUp       = await checkPort(7051, 'peer0.issuer.scatterid.com') || await checkPort(7051, '127.0.0.1');
  const verifierPeerUp     = await checkPort(8051, 'peer0.verifier.scatterid.com') || await checkPort(8051, '127.0.0.1');

  let reconciliation = { lastReconciledAt: null, mismatchCount: 0, discrepancies: [] };
  if (verificationApiUp) {
    try {
      const reconRes = await fetch(`${VERIFICATION_API_URL}/reconciliation`, {
        headers: getVerificationApiHeaders(),
        signal: AbortSignal.timeout(3000)
      });
      if (reconRes.ok) {
        reconciliation = await reconRes.json();
      }
    } catch (_) {}
  }

  res.json({
    services: {
      cryptoService: cryptoServiceUp ? 'RUNNING' : 'STOPPED',
      verificationApi: verificationApiUp ? 'RUNNING' : 'STOPPED'
    },
    blockchain: {
      orderer: ordererUp ? 'RUNNING' : 'OFFLINE',
      issuerPeer: issuerPeerUp ? 'RUNNING' : 'OFFLINE',
      verifierPeer: verifierPeerUp ? 'RUNNING' : 'OFFLINE'
    },
    reconciliation: {
      lastReconciledAt: reconciliation.lastReconciledAt,
      mismatchCount: reconciliation.mismatchCount || 0,
      discrepancies: reconciliation.discrepancies || []
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
// /api/audit — proxy audit log from verification-api
// ---------------------------------------------------------------------------
app.get('/api/audit', async (req, res) => {
  try {
    const limit = req.query.limit || 50;
    const response = await fetch(`${VERIFICATION_API_URL}/audit?limit=${limit}`, {
      headers: getVerificationApiHeaders(),
      signal: AbortSignal.timeout(5000)
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Failed to proxy audit log query:', err.stack || err.message);
    res.json({ success: false, error: 'Verification API unreachable', logs: [] });
  }
});

// ---------------------------------------------------------------------------
// /api/issue — unified SDK issuance endpoint
// Uses official ScatterIDClient with RFC 8785 canonicalization + 16-byte salt + SHA3-256
// ---------------------------------------------------------------------------
app.post('/api/issue', async (req, res) => {
  const { claim, dataHash: precomputedHash, idempotencyKey } = req.body;

  try {
    if (claim && typeof claim === 'object') {
      const sdkClient = new ScatterIDClient({
        apiKey: VERIFICATION_API_KEY,
        issuanceUrl: VERIFICATION_API_URL,
        verificationUrl: VERIFICATION_API_URL
      });
      const result = await sdkClient.issue(claim, idempotencyKey);
      return res.status(201).json(result);
    } else if (precomputedHash) {
      if (!/^[0-9a-fA-F]{64}$/.test(precomputedHash)) {
        return res.status(400).json({ error: 'Invalid dataHash: must be a 64-character hex string' });
      }
      const response = await fetch(`${VERIFICATION_API_URL}/issue`, {
        method: 'POST',
        headers: getVerificationApiHeaders(),
        body: JSON.stringify({ dataHash: precomputedHash, idempotencyKey }),
      });
      const data = await response.json();
      return res.status(response.status).json(data);
    } else {
      return res.status(400).json({
        error: 'Request must include either a "claim" object or a pre-computed "dataHash" string'
      });
    }
  } catch (err) {
    console.error('Failed in issue route:', err.stack || err.message);
    res.status(500).json({ error: err.message || 'Issuance failed' });
  }
});

// ---------------------------------------------------------------------------
// /api/issue/:credentialId/retry-anchor — proxy retry-anchor to verification-api
// ---------------------------------------------------------------------------
app.post('/api/issue/:credentialId/retry-anchor', async (req, res) => {
  const { credentialId } = req.params;
  try {
    const response = await fetch(`${VERIFICATION_API_URL}/issue/${credentialId}/retry-anchor`, {
      method: 'POST',
      headers: getVerificationApiHeaders(),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error('Failed to proxy retry-anchor:', err.stack || err.message);
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
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: 'Verification API unreachable' });
  }
});

// ---------------------------------------------------------------------------
// /api/rotate-key — POST /rotate to Python Crypto Service via mTLS
// ---------------------------------------------------------------------------
app.post('/api/rotate-key', async (req, res) => {
  try {
    const cryptoUrl = `${CRYPTO_SERVICE_URL}/rotate`;
    const response = await fetch(cryptoUrl, {
      method: 'POST',
      headers: getCryptoServiceHeaders(),
      signal: AbortSignal.timeout(10000)
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: data.error || `Crypto service returned HTTP ${response.status}`,
        details: data
      });
    }

    res.json({
      success: true,
      message: 'Key rotation executed successfully',
      publicKeyId: data.publicKeyId || data.new_key_id,
      algorithm: data.algorithm || 'ML-DSA-65',
      rotatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('Key rotation failed:', err.stack || err.message);
    res.status(502).json({
      success: false,
      error: `Failed to communicate with crypto-service: ${err.message}`
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`ScatterID Operator Dashboard running at http://0.0.0.0:${PORT}`);
});
