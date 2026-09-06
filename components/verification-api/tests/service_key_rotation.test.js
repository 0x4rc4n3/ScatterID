// Tests for Service-to-Service Key Rotation Lifecycle, Dual-Key Grace Windows, and Key Age Audit
// Finding 2 (High) remediation verification

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../..');

// Configure test environment keys before importing server
process.env.VERIFICATION_API_KEY = 'primary-verify-key-0123456789abcdef0123456789abcdef';
process.env.VERIFICATION_API_KEY_PREVIOUS = 'previous-verify-key-0123456789abcdef0123456789abcdef';
process.env.REVOKE_API_KEY = 'primary-revoke-key-0123456789abcdef0123456789abcdef';
process.env.REVOKE_API_KEY_PREVIOUS = 'previous-revoke-key-0123456789abcdef0123456789abcdef';
process.env.CRYPTO_SERVICE_API_KEY = 'crypto-service-key-0123456789abcdef0123456789abcdef';
process.env.NODE_ENV = 'test';

const { createApp, checkKeyAge } = await import('../src/server.js');

describe('Service Key Lifecycle & Zero-Downtime Dual-Key Rotation', () => {
  const app = createApp({ rateLimitMax: 10000 });
  const client = supertest(app);

  test('GET /healthz returns key rotation health posture', async () => {
    const res = await client.get('/healthz');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
    assert.ok(res.body.keyRotation);
    assert.equal(res.body.keyRotation.dualKeyGraceActive, true);
  });

  test('Primary VERIFICATION_API_KEY passes authentication on protected endpoint', async () => {
    const res = await client.get('/credentials')
      .set('Authorization', `Bearer ${process.env.VERIFICATION_API_KEY}`);
    assert.equal(res.status, 200);
    assert.equal(res.header['x-key-rotation-status'], undefined);
  });

  test('Previous VERIFICATION_API_KEY passes authentication with grace-period header', async () => {
    const res = await client.get('/credentials')
      .set('Authorization', `Bearer ${process.env.VERIFICATION_API_KEY_PREVIOUS}`);
    assert.equal(res.status, 200);
    assert.equal(res.header['x-key-rotation-status'], 'grace-period-active');
  });

  test('Stale or unauthorized Bearer token is rejected with HTTP 401', async () => {
    const res = await client.get('/credentials')
      .set('Authorization', 'Bearer stale-unauthorized-key-token');
    assert.equal(res.status, 401);
    assert.equal(res.body.code, 'INVALID_AUTH');
  });

  test('Primary REVOKE_API_KEY passes authentication on POST /revoke', async () => {
    const res = await client.post('/revoke')
      .set('X-Revoke-Key', process.env.REVOKE_API_KEY)
      .send({ credentialId: '00000000-0000-0000-0000-000000000000' });
    // Should fail schema validation or DB lookup, but NOT auth (400 or 404, not 401/403)
    assert.notEqual(res.status, 401);
    assert.notEqual(res.status, 403);
  });

  test('Previous REVOKE_API_KEY passes authentication on POST /revoke with grace header', async () => {
    const res = await client.post('/revoke')
      .set('X-Revoke-Key', process.env.REVOKE_API_KEY_PREVIOUS)
      .send({ credentialId: '00000000-0000-0000-0000-000000000000' });
    assert.notEqual(res.status, 401);
    assert.notEqual(res.status, 403);
    assert.equal(res.header['x-key-rotation-status'], 'grace-period-active');
  });

  test('Stale or unauthorized Revoke key is rejected with HTTP 403', async () => {
    const res = await client.post('/revoke')
      .set('X-Revoke-Key', 'stale-invalid-revoke-key')
      .send({ credentialId: '00000000-0000-0000-0000-000000000000' });
    assert.equal(res.status, 403);
    assert.equal(res.body.code, 'REVOCATION_UNAUTHORIZED');
  });

  test('checkKeyAge evaluates rotation SLA correctly based on timestamp', () => {
    const now = Date.now();

    // 5 days old -> valid
    process.env.KEY_ROTATION_TIMESTAMP = new Date(now - 5 * 86400 * 1000).toISOString();
    process.env.KEY_MAX_AGE_DAYS = '90';
    let health = checkKeyAge(now);
    assert.equal(health.status, 'valid');
    assert.equal(health.rotationDue, false);
    assert.equal(health.expired, false);

    // 35 days old -> rotation_due
    process.env.KEY_ROTATION_TIMESTAMP = new Date(now - 35 * 86400 * 1000).toISOString();
    health = checkKeyAge(now);
    assert.equal(health.status, 'rotation_due');
    assert.equal(health.rotationDue, true);
    assert.equal(health.expired, false);

    // 95 days old -> expired
    process.env.KEY_ROTATION_TIMESTAMP = new Date(now - 95 * 86400 * 1000).toISOString();
    health = checkKeyAge(now);
    assert.equal(health.status, 'expired');
    assert.equal(health.rotationDue, true);
    assert.equal(health.expired, true);
  });

  test('Key rotation and audit scripts execute and manage keys safely', () => {
    const tmpEnv = path.join(ROOT_DIR, '.env.test_rotation');
    try {
      // Create test environment file
      fs.writeFileSync(tmpEnv, `CRYPTO_SERVICE_API_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
VERIFICATION_API_KEY=1123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
GATEWAY_API_KEY=2123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
REVOKE_API_KEY=3123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
JWT_SECRET=4123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
KEY_ROTATION_TIMESTAMP=${new Date().toISOString()}
KEY_MAX_AGE_DAYS=30
`);

      // Run audit script
      const auditOut = execSync(`bash scripts/security/audit_service_keys.sh --env-file ${tmpEnv}`, {
        cwd: ROOT_DIR,
        encoding: 'utf8'
      });
      assert.match(auditOut, /AUDIT PASSED/);

      // Run rotate script in stage mode
      const rotateStageOut = execSync(`bash scripts/security/rotate_service_keys.sh --stage --env-file ${tmpEnv}`, {
        cwd: ROOT_DIR,
        encoding: 'utf8'
      });
      assert.match(rotateStageOut, /Staged rotation complete/);

      const contentAfterStage = fs.readFileSync(tmpEnv, 'utf8');
      assert.match(contentAfterStage, /VERIFICATION_API_KEY_PREVIOUS=/);

      // Run rotate script in finalize mode
      const rotateFinalOut = execSync(`bash scripts/security/rotate_service_keys.sh --finalize --env-file ${tmpEnv}`, {
        cwd: ROOT_DIR,
        encoding: 'utf8'
      });
      assert.match(rotateFinalOut, /Key rotation finalized/);

      const contentAfterFinal = fs.readFileSync(tmpEnv, 'utf8');
      assert.doesNotMatch(contentAfterFinal, /VERIFICATION_API_KEY_PREVIOUS=/);
    } finally {
      if (fs.existsSync(tmpEnv)) {
        fs.unlinkSync(tmpEnv);
      }
    }
  });
});
