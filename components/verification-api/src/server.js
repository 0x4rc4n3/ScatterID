// TLS trust for crypto-service is established via NODE_EXTRA_CA_CERTS
// pointing to the ScatterID internal CA cert (ca.crt). Never disable
// certificate verification globally.
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { timingSafeEqual, createHash } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { issueRoute } from './routes/issue.js';
import { statusRoute } from './routes/status.js';
import { verifyRoute } from './routes/verify.js';
import { getAllCredentials } from './db/models.js';
import { getConfig } from './config.js';

const VERIFICATION_API_KEY = getConfig('security.crypto_service_api_key', process.env.VERIFICATION_API_KEY || '');

// Fail fast at startup if no inbound API key is configured.
// Without this, the issuance and credential-list endpoints are wide open.
if (!VERIFICATION_API_KEY) {
  console.error(
    'FATAL: VERIFICATION_API_KEY (or config security.crypto_service_api_key) must be set. ' +
    'The verification-api cannot start without an inbound authentication key.'
  );
  process.exit(1);
}

const app = express();
app.use(express.json());
app.use(helmet());

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later', code: 'RATE_LIMITED' }
});

app.use('/issue', apiLimiter);
app.use('/verify', apiLimiter);
app.use('/status', apiLimiter);
app.use('/credentials', apiLimiter);

/**
 * Timing-safe Bearer token middleware.
 *
 * Both buffers are hashed to a fixed length before comparison so that
 * a length mismatch does not create a length-oracle side-channel.
 * The SHA-256 operation itself is constant-time with respect to content,
 * and timingSafeEqual ensures the comparison is constant-time.
 */
export function requireBearerAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized', code: 'MISSING_AUTH' });
  }

  const token = authHeader.slice(7);
  // Hash both sides to a fixed 32-byte length before comparing.
  // This eliminates the length-oracle even when raw lengths differ.
  const tokenHash = createHash('sha256').update(token).digest();
  const keyHash   = createHash('sha256').update(VERIFICATION_API_KEY).digest();

  if (!timingSafeEqual(tokenHash, keyHash)) {
    return res.status(401).json({ error: 'Unauthorized', code: 'INVALID_AUTH' });
  }

  next();
}

// Health check endpoint for container orchestrators and quickstart scripts (unauthenticated)
app.get('/healthz', (req, res) => res.json({ status: 'ok', service: 'verification-api' }));

// /verify is intentionally left open to unauthenticated callers —
// verification is a read-only operation on already-public proofs and
// is meant to be callable by third-party verifiers without a key.
// Every other endpoint that mutates state or dumps the full table is gated.
app.post('/verify', verifyRoute);

// All write endpoints and the credential dump require auth.
app.post('/issue', requireBearerAuth, issueRoute);
app.get('/status/:id', requireBearerAuth, statusRoute);
app.post('/revoke', requireBearerAuth, async (req, res) => {
  try {
    const { credentialId } = req.body;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!credentialId || !uuidRegex.test(credentialId)) {
      return res.status(400).json({ error: 'Invalid parameter: credentialId must be a valid UUID v4', code: 'INVALID_PARAMETER' });
    }

    const { getCredentialById, updateStatus } = await import('./db/models.js');
    const { revokeProof } = await import('./chain/fabric.js');

    const record = await getCredentialById(credentialId);
    if (!record) {
      return res.status(404).json({ error: 'Credential not found', code: 'NOT_FOUND' });
    }

    try {
      await revokeProof(credentialId, process.env.FABRIC_MSP_ID || 'IssuerMSP');
    } catch (fabricErr) {
      console.warn('Fabric revoke warning (may already be revoked or mock):', fabricErr.message);
    }

    await updateStatus(credentialId, 'revoked');
    res.json({ success: true, credentialId, status: 'revoked', message: 'Credential revoked successfully' });
  } catch (err) {
    console.error('Failed to revoke credential:', err.stack || err.message);
    res.status(500).json({ error: 'Internal Server Error', code: 'INTERNAL_ERROR' });
  }
});
app.get('/credentials', requireBearerAuth, async (req, res) => {
  try {
    const credentials = await getAllCredentials();
    res.json({ success: true, credentials });
  } catch (err) {
    console.error('Failed to get credentials:', err.stack || err.message);
    res.status(500).json({ success: false, error: 'Internal Server Error', credentials: [] });
  }
});

export { app };

const __filename = fileURLToPath(import.meta.url);
const isMain = process.argv[1] && path.resolve(process.argv[1]) === __filename;

if (isMain) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Verification API listening on port ${PORT}`);
  });

  process.on('SIGTERM', () => {
    console.log('Verification API received SIGTERM, exiting...');
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log('Verification API received SIGINT, exiting...');
    process.exit(0);
  });
}
