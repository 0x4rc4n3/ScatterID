// Argon2id Password Hashing & Verification Engine
// Document ID: SEC-OPS-06

import argon2 from 'argon2';

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536, // 64 MB
  timeCost: 3,       // 3 iterations
  parallelism: 4     // 4 threads
};

/**
 * Hashes a plaintext password using Argon2id with NIST-compliant parameters.
 */
export async function hashPassword(plaintext) {
  if (!plaintext || typeof plaintext !== 'string') {
    throw new Error('Password must be a non-empty string');
  }
  return await argon2.hash(plaintext, ARGON2_OPTIONS);
}

/**
 * Verifies a plaintext password against an Argon2id hash.
 * Constant-time evaluation to prevent timing side-channel attacks.
 */
export async function verifyPassword(hash, plaintext) {
  if (!hash || !plaintext) {
    return false;
  }
  try {
    return await argon2.verify(hash, plaintext);
  } catch (err) {
    return false;
  }
}

export default {
  hashPassword,
  verifyPassword
};
