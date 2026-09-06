// Single-Use Recovery Codes Utility (XXXX-XXXX-XXXX)
// Document ID: SEC-OPS-06

import crypto from 'node:crypto';

const CODE_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Exclude ambiguous chars (0, 1, I, O)
const DEV_FALLBACK_PEPPER = 'scatterid-dev-recovery-pepper-256bit-default-key!';

/**
 * Retrieves the server-side HMAC pepper for recovery codes.
 * In production (NODE_ENV=production or strictly configured), enforces 128+ bits entropy.
 */
export function getRecoveryCodePepper() {
  const envPepper = process.env.RECOVERY_CODE_PEPPER;
  if (envPepper) {
    if (Buffer.byteLength(envPepper, 'utf8') < 16) {
      throw new Error('CRITICAL: RECOVERY_CODE_PEPPER must be at least 16 bytes (128 bits) of entropy');
    }
    return envPepper;
  }

  // Enforce pepper availability in production mode
  if (process.env.NODE_ENV === 'production') {
    throw new Error('CRITICAL: RECOVERY_CODE_PEPPER environment variable is required in production');
  }

  return DEV_FALLBACK_PEPPER;
}

/**
 * Generates a single formatted recovery code (e.g. 4D9K-7W2P-8QXM).
 */
export function generateSingleRecoveryCode() {
  const bytes = crypto.randomBytes(12);
  let code = '';
  for (let i = 0; i < 12; i++) {
    code += CODE_CHARS[bytes[i] % CODE_CHARS.length];
    if (i === 3 || i === 7) {
      code += '-';
    }
  }
  return code;
}

/**
 * Generates a batch of N (default 8) unique single-use recovery codes.
 */
export function generateRecoveryCodesBatch(count = 8) {
  const codes = new Set();
  while (codes.size < count) {
    codes.add(generateSingleRecoveryCode());
  }
  return Array.from(codes);
}

/**
 * Normalizes a user-input recovery code (removes dashes, spaces, converts to uppercase).
 */
export function normalizeRecoveryCode(rawCode) {
  if (!rawCode || typeof rawCode !== 'string') return '';
  return rawCode.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

/**
 * Hashes a recovery code using HMAC-SHA256 with server-side pepper for database storage.
 * Neutralizes offline brute-force attacks against compromised database dumps.
 */
export function hashRecoveryCode(rawCode, pepper = null) {
  const normalized = normalizeRecoveryCode(rawCode);
  const activePepper = (typeof pepper === 'string' && pepper.length > 0) ? pepper : getRecoveryCodePepper();
  return crypto.createHmac('sha256', activePepper).update(normalized).digest('hex');
}

/**
 * Legacy unkeyed SHA-256 hash retained strictly for backward compatibility verification.
 */
export function hashRecoveryCodeLegacy(rawCode) {
  const normalized = normalizeRecoveryCode(rawCode);
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Verifies whether a raw recovery code matches a stored candidate hash.
 * Supports current HMAC-SHA256 and gracefully falls back to legacy unkeyed SHA-256.
 */
export function verifyRecoveryCodeMatch(rawCode, candidateHash, pepper = null) {
  if (!rawCode || !candidateHash) return false;
  const hmacHash = hashRecoveryCode(rawCode, pepper);
  const legacyHash = hashRecoveryCodeLegacy(rawCode);

  const candidateBuf = Buffer.from(candidateHash, 'hex');
  if (candidateBuf.length !== 32) return false;

  const hmacBuf = Buffer.from(hmacHash, 'hex');
  const legacyBuf = Buffer.from(legacyHash, 'hex');

  // Constant-time check against keyed HMAC-SHA256
  if (crypto.timingSafeEqual(candidateBuf, hmacBuf)) {
    return true;
  }

  // Backward-compatible fallback: constant-time check against unkeyed SHA-256
  if (crypto.timingSafeEqual(candidateBuf, legacyBuf)) {
    return true;
  }

  return false;
}

export default {
  getRecoveryCodePepper,
  generateSingleRecoveryCode,
  generateRecoveryCodesBatch,
  normalizeRecoveryCode,
  hashRecoveryCode,
  hashRecoveryCodeLegacy,
  verifyRecoveryCodeMatch
};
