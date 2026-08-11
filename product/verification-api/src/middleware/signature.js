import { createHmac, timingSafeEqual } from 'crypto';
import { redisClient, isRedisConnected } from '../redis.js';

// Canonicalize JSON utility to ensure consistent key ordering
function canonicalizeJson(obj) {
  if (obj === undefined) return '';
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalizeJson).join(',') + ']';
  }
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => `${JSON.stringify(k)}:${canonicalizeJson(obj[k])}`).join(',') + '}';
}

export async function verifyHmacSignature(req, res, next) {
  try {
    const signatureHeader = req.headers['x-signature'];
    const timestampHeader = req.headers['x-timestamp'];
    const nonceHeader = req.headers['x-nonce'];

    if (!signatureHeader || !timestampHeader || !nonceHeader) {
      return res.status(400).json({
        error: 'Bad Request: Missing security headers (X-Signature, X-Timestamp, X-Nonce)',
        code: 'MISSING_SECURITY_HEADERS'
      });
    }

    const timestamp = parseInt(timestampHeader, 10);
    if (isNaN(timestamp)) {
      return res.status(400).json({
        error: 'Bad Request: Invalid timestamp format',
        code: 'INVALID_TIMESTAMP'
      });
    }

    // 1. Replay Window Verification (Reject if request is > 5 minutes old)
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > 300) {
      return res.status(401).json({
        error: 'Unauthorized: Request expired (replay window exceeded)',
        code: 'REQUEST_EXPIRED'
      });
    }

    const tenantId = req.tenantId || 'default-tenant';
    const nonceKey = `nonce:${tenantId}:${nonceHeader}`;

    // 2. Nonce Replay Prevention (Verify nonce has not been executed previously)
    if (isRedisConnected()) {
      try {
        const exists = await redisClient.exists(nonceKey);
        if (exists) {
          return res.status(401).json({
            error: 'Unauthorized: Nonce replay detected',
            code: 'NONCE_REPLAY'
          });
        }
        // Cache nonce in Redis for 5 minutes (300 seconds TTL)
        await redisClient.set(nonceKey, '1', { EX: 300 });
      } catch (redisErr) {
        console.warn('Redis nonce check failed, bypassing protection:', redisErr.message);
      }
    }

    // 3. HMAC-SHA256 Signature Verification
    if (!req.apiKey) {
      return res.status(501).json({
        error: 'Internal Server Error: Missing cryptographic key context',
        code: 'MISSING_KEY_CONTEXT'
      });
    }

    const bodyStr = Object.keys(req.body || {}).length > 0 ? canonicalizeJson(req.body) : '';
    const payloadStr = `${timestamp}.${nonceHeader}.${bodyStr}`;

    const computedHmacHex = createHmac('sha256', req.apiKey)
      .update(payloadStr)
      .digest('hex');

    const signatureBuf = Buffer.from(signatureHeader, 'utf-8');
    const computedBuf = Buffer.from(computedHmacHex, 'utf-8');

    // Use constant-time buffer comparison to prevent timing attacks
    if (signatureBuf.length !== computedBuf.length || !timingSafeEqual(signatureBuf, computedBuf)) {
      return res.status(401).json({
        error: 'Unauthorized: Cryptographic signature mismatch',
        code: 'INVALID_SIGNATURE'
      });
    }

    next();
  } catch (err) {
    console.error('Signature Verification Middleware Error:', err.stack || err.message);
    return res.status(500).json({
      error: 'Internal Server Error',
      code: 'INTERNAL_ERROR'
    });
  }
}
