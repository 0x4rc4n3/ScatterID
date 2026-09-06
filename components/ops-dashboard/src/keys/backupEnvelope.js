// Encrypted PQC Key Backup Envelope Utility (.enc)
// AES-256-GCM + PBKDF2 Master Passphrase Derivation + HMAC Integrity Tag
// Document ID: SEC-OPS-06

import crypto from 'node:crypto';

const KDF_ITERATIONS = 100000;
const KEY_LENGTH = 32; // 256 bits

/**
 * Derives a 256-bit encryption key from a master passphrase and salt.
 */
function deriveKey(passphrase, saltBuffer) {
  return crypto.pbkdf2Sync(passphrase, saltBuffer, KDF_ITERATIONS, KEY_LENGTH, 'sha256');
}

/**
 * Exports PQC keys into an AES-256-GCM encrypted envelope.
 */
export function exportEncryptedEnvelope({ masterPassphrase, keys, metadata = {} }) {
  if (!masterPassphrase || masterPassphrase.length < 12) {
    throw new Error('Master backup passphrase must be at least 12 characters');
  }

  const salt = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  const derivedKey = deriveKey(masterPassphrase, salt);

  const plainEnvelope = {
    header: {
      type: 'SCATTERID_PQC_KEY_BACKUP',
      version: '1.0.0',
      exported_at: new Date().toISOString(),
      metadata
    },
    keys
  };

  const plainText = JSON.stringify(plainEnvelope);
  const integrityHmac = crypto.createHmac('sha256', derivedKey).update(plainText).digest('hex');

  const payloadWithTag = JSON.stringify({
    payload: plainEnvelope,
    integrity_hmac: integrityHmac
  });

  const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv);
  let ciphertext = cipher.update(payloadWithTag, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  const envelope = {
    format: 'SCATTERID_PQC_ENVELOPE_V1',
    algorithm: 'AES-256-GCM',
    kdf: 'PBKDF2-HMAC-SHA256',
    kdf_iterations: KDF_ITERATIONS,
    salt_hex: salt.toString('hex'),
    iv_hex: iv.toString('hex'),
    auth_tag_hex: authTag,
    ciphertext_hex: ciphertext
  };

  return JSON.stringify(envelope, null, 2);
}

/**
 * Restores and decrypts keys from an encrypted envelope (.enc payload).
 */
export function restoreEncryptedEnvelope({ masterPassphrase, envelopeContent }) {
  if (!masterPassphrase) {
    throw new Error('Master backup passphrase is required for restore');
  }

  let envelope;
  try {
    envelope = typeof envelopeContent === 'string' ? JSON.parse(envelopeContent) : envelopeContent;
  } catch (err) {
    throw new Error('Invalid envelope JSON format');
  }

  if (envelope.format !== 'SCATTERID_PQC_ENVELOPE_V1' || envelope.algorithm !== 'AES-256-GCM') {
    throw new Error('Unsupported backup envelope format or cipher algorithm');
  }

  const salt = Buffer.from(envelope.salt_hex, 'hex');
  const iv = Buffer.from(envelope.iv_hex, 'hex');
  const authTag = Buffer.from(envelope.auth_tag_hex, 'hex');
  const ciphertext = envelope.ciphertext_hex;

  const derivedKey = deriveKey(masterPassphrase, salt);

  let decryptedJson;
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', derivedKey, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    decryptedJson = JSON.parse(decrypted);
  } catch (err) {
    throw new Error('Decryption failed: Incorrect master passphrase or corrupted envelope payload');
  }

  const { payload, integrity_hmac } = decryptedJson;
  const computedHmac = crypto.createHmac('sha256', derivedKey).update(JSON.stringify(payload)).digest('hex');

  if (computedHmac !== integrity_hmac) {
    throw new Error('HMAC integrity verification failed: envelope payload has been tampered with');
  }

  return payload;
}

export default {
  exportEncryptedEnvelope,
  restoreEncryptedEnvelope
};
