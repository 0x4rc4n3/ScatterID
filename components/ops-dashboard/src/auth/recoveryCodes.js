// Single-Use Recovery Codes Utility (XXXX-XXXX-XXXX)
// Document ID: SEC-OPS-06

import crypto from 'node:crypto';

const CODE_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Exclude ambiguous chars (0, 1, I, O)

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
 * Hashes a recovery code using SHA-256 for persistent database storage.
 */
export function hashRecoveryCode(rawCode) {
  const normalized = normalizeRecoveryCode(rawCode);
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

export default {
  generateSingleRecoveryCode,
  generateRecoveryCodesBatch,
  normalizeRecoveryCode,
  hashRecoveryCode
};
