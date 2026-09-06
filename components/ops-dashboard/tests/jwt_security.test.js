// Tests for Ops Dashboard JWT Session Secret Security & Fail-Fast Entropy Validation
// Finding 1 (Critical) remediation verification

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { signToken, verifyToken, getJwtSecret, MIN_JWT_SECRET_ENTROPY_BYTES } from '../src/auth/tokens.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVER_PATH = path.resolve(__dirname, '../src/server.js');

describe('Ops Dashboard JWT Security & Entropy Validation', () => {
  const VALID_256_BIT_SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  test('startup fails with exit code 1 when JWT_SECRET is unset', () => {
    const env = { ...process.env };
    delete env.JWT_SECRET;

    const result = spawnSync('node', ['-e', `import('${SERVER_PATH}')`], {
      env,
      encoding: 'utf8'
    });

    assert.equal(result.status, 1, 'Process must exit with code 1 when JWT_SECRET is missing');
    assert.match(result.stderr, /FATAL: JWT_SECRET environment variable must be set/);
  });

  test('startup fails with exit code 1 when JWT_SECRET is below 32 bytes (< 256 bits)', () => {
    const env = { ...process.env, JWT_SECRET: 'short-secret-under-32-bytes' };

    const result = spawnSync('node', ['-e', `import('${SERVER_PATH}')`], {
      env,
      encoding: 'utf8'
    });

    assert.equal(result.status, 1, 'Process must exit with code 1 when JWT_SECRET entropy is insufficient');
    assert.match(result.stderr, /FATAL: JWT_SECRET entropy is insufficient/);
  });

  test('tokens.js throws when JWT_SECRET is missing', () => {
    const savedSecret = process.env.JWT_SECRET;
    try {
      delete process.env.JWT_SECRET;
      assert.throws(() => {
        getJwtSecret();
      }, /CRITICAL: JWT_SECRET environment variable is missing/);

      assert.throws(() => {
        signToken({ sub: 'admin' });
      }, /CRITICAL: JWT_SECRET environment variable is missing/);
    } finally {
      process.env.JWT_SECRET = savedSecret;
    }
  });

  test('tokens.js throws when JWT_SECRET is below minimum entropy threshold', () => {
    const savedSecret = process.env.JWT_SECRET;
    try {
      process.env.JWT_SECRET = 'weak-16-bytes!';
      assert.throws(() => {
        getJwtSecret();
      }, /CRITICAL: JWT_SECRET entropy is insufficient/);

      assert.throws(() => {
        signToken({ sub: 'admin' });
      }, /CRITICAL: JWT_SECRET entropy is insufficient/);
    } finally {
      process.env.JWT_SECRET = savedSecret;
    }
  });

  test('tokens.js successfully mints and verifies token with valid 256-bit secret', () => {
    const savedSecret = process.env.JWT_SECRET;
    try {
      process.env.JWT_SECRET = VALID_256_BIT_SECRET;
      const payload = { userId: 'root-admin', role: 'root' };
      const token = signToken(payload, 3600);
      assert.ok(token);

      const decoded = verifyToken(token);
      assert.equal(decoded.userId, 'root-admin');
      assert.equal(decoded.role, 'root');
    } finally {
      process.env.JWT_SECRET = savedSecret;
    }
  });

  test('tokens.js rejects tampered signature or token modified in transit', () => {
    const savedSecret = process.env.JWT_SECRET;
    try {
      process.env.JWT_SECRET = VALID_256_BIT_SECRET;
      const token = signToken({ role: 'mod' }, 3600);
      const parts = token.split('.');
      // Tamper with signature
      const tampered = `${parts[0]}.${parts[1]}.badsignature`;
      assert.throws(() => {
        verifyToken(tampered);
      }, /Invalid token signature/);
    } finally {
      process.env.JWT_SECRET = savedSecret;
    }
  });

  test('legacy hardcoded fallback secret is rejected and unusable', () => {
    const savedSecret = process.env.JWT_SECRET;
    try {
      delete process.env.JWT_SECRET;
      assert.throws(() => {
        signToken({ sub: 'attacker' });
      }, /CRITICAL: JWT_SECRET environment variable is missing/);
    } finally {
      process.env.JWT_SECRET = savedSecret;
    }
  });
});
