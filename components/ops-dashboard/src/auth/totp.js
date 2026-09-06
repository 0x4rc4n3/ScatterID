// RFC 6238 TOTP Multi-Factor Authentication Engine
// Supports Base32 secret generation, RFC 6238 time-based verification,
// AES-256-GCM secret encryption/decryption, and QR code generation

import crypto from 'node:crypto';
import QRCode from 'qrcode';

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Encodes a buffer into RFC 4648 Base32 string.
 */
export function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      output += BASE32_CHARS[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_CHARS[(value << (5 - bits)) & 31];
  }

  return output;
}

/**
 * Decodes an RFC 4648 Base32 string into a buffer.
 */
export function base32Decode(base32) {
  const clean = base32.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  let bits = 0;
  let value = 0;
  const bytes = [];

  for (let i = 0; i < clean.length; i++) {
    const val = BASE32_CHARS.indexOf(clean[i]);
    if (val === -1) {
      throw new Error(`Invalid Base32 character: ${clean[i]}`);
    }

    value = (value << 5) | val;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/**
 * Generates a cryptographically secure 20-byte (160-bit) Base32 secret.
 */
export function generateTotpSecret() {
  const buffer = crypto.randomBytes(20);
  return base32Encode(buffer);
}

/**
 * Computes the 6-digit TOTP code for a secret at a specific Unix timestamp.
 * Standard: RFC 6238 (HMAC-SHA1, 30-second step, 6 digits).
 */
export function generateTotpCode(secretBase32, timestampMs = Date.now(), stepSeconds = 30) {
  const key = base32Decode(secretBase32);
  const counter = Math.floor(timestampMs / 1000 / stepSeconds);

  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const hmac = crypto.createHmac('sha1', key);
  hmac.update(counterBuffer);
  const digest = hmac.digest();

  // Dynamic truncation per RFC 4226 §5.4
  const offset = digest[digest.length - 1] & 0x0f;
  const codeInt = (
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff)
  ) % 1000000;

  return codeInt.toString().padStart(6, '0');
}

/**
 * Validates a 6-digit TOTP code against a secret with a tolerance window.
 * Default window is ±1 step (allows 30s clock drift in either direction).
 */
export function verifyTotpCode(secretBase32, token, window = 1, timestampMs = Date.now()) {
  if (!secretBase32 || !token || typeof token !== 'string') {
    return false;
  }
  const cleanToken = token.trim();
  if (cleanToken.length !== 6 || !/^\d{6}$/.test(cleanToken)) {
    return false;
  }

  const stepMs = 30 * 1000;

  for (let errorWindow = -window; errorWindow <= window; errorWindow++) {
    const checkTime = timestampMs + errorWindow * stepMs;
    const expected = generateTotpCode(secretBase32, checkTime);
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(cleanToken))) {
      return true;
    }
  }

  return false;
}

/**
 * Constructs an otpauth:// URI for mobile authenticator enrollment.
 */
export function getTotpUri(secretBase32, username, issuer = 'ScatterID') {
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedUser = encodeURIComponent(username);
  return `otpauth://totp/${encodedIssuer}:${encodedUser}?secret=${secretBase32}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Generates QR code as Data URL (PNG base64).
 */
export async function generateQrDataUrl(otpauthUri) {
  return await QRCode.toDataURL(otpauthUri, { errorCorrectionLevel: 'M', margin: 2 });
}

/**
 * Generates ASCII QR code string for terminal display (break-glass CLI).
 */
export async function generateQrTerminalString(otpauthUri) {
  return await QRCode.toString(otpauthUri, { type: 'terminal', small: true });
}

// AES-256-GCM Encryption for TOTP secrets stored in SQLite
function getEncryptionKey() {
  const keySecret = process.env.MFA_ENCRYPTION_KEY || 'scatterid-default-master-key-seed-2026';
  return crypto.createHash('sha256').update(keySecret).digest();
}

/**
 * Encrypts a Base32 secret using AES-256-GCM.
 */
export function encryptTotpSecret(plainSecret) {
  if (!plainSecret) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  
  let encrypted = cipher.update(plainSecret, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `enc:v1:${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts an AES-256-GCM encrypted TOTP secret.
 * Gracefully handles unencrypted secrets for migration backwards-compatibility.
 */
export function decryptTotpSecret(encryptedString) {
  if (!encryptedString) return null;
  if (!encryptedString.startsWith('enc:v1:')) {
    // Plaintext fallback (e.g. initial setup)
    return encryptedString;
  }

  const parts = encryptedString.split(':');
  if (parts.length !== 5) {
    throw new Error('Corrupted encrypted TOTP secret format');
  }

  const iv = Buffer.from(parts[2], 'hex');
  const authTag = Buffer.from(parts[3], 'hex');
  const ciphertext = parts[4];

  const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

export default {
  base32Encode,
  base32Decode,
  generateTotpSecret,
  generateTotpCode,
  verifyTotpCode,
  getTotpUri,
  generateQrDataUrl,
  generateQrTerminalString,
  encryptTotpSecret,
  decryptTotpSecret
};
