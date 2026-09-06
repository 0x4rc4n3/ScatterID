// Cryptographic Session Token Engine (HMAC-SHA256)
// Zero external dependency token signing and verification

import crypto from 'node:crypto';

function getJwtSecret() {
  return process.env.JWT_SECRET || 'scatterid-ops-dashboard-session-secret-key-2026';
}

function base64UrlEncode(strOrBuffer) {
  const buf = Buffer.isBuffer(strOrBuffer) ? strOrBuffer : Buffer.from(strOrBuffer, 'utf8');
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

/**
 * Mints a cryptographically signed token.
 * Default expiration: 8 hours (28800 seconds).
 */
export function signToken(payload, expiresInSeconds = 28800) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const data = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto.createHmac('sha256', getJwtSecret()).update(data).digest();
  const encodedSignature = base64UrlEncode(signature);

  return `${data}.${encodedSignature}`;
}

/**
 * Verifies a token and returns the decoded payload.
 * Throws an error if invalid, altered, or expired.
 */
export function verifyToken(token) {
  if (!token || typeof token !== 'string') {
    throw new Error('Token missing or invalid format');
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed token structure');
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const data = `${encodedHeader}.${encodedPayload}`;

  const expectedSignature = crypto.createHmac('sha256', getJwtSecret()).update(data).digest();
  const providedSignature = Buffer.from(encodedSignature.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

  if (expectedSignature.length !== providedSignature.length ||
      !crypto.timingSafeEqual(expectedSignature, providedSignature)) {
    throw new Error('Invalid token signature');
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload));
  const now = Math.floor(Date.now() / 1000);

  if (payload.exp && payload.exp < now) {
    throw new Error('Token has expired');
  }

  return payload;
}

export default {
  signToken,
  verifyToken
};
