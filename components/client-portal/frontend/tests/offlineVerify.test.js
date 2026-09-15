// components/client-portal/frontend/tests/offlineVerify.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  canonicalize,
  sha3_256,
  verifyCredentialOffline,
} from '../src/api/offlineVerify.ts';

describe('ScatterID Client-Side Offline Verifier (FIPS 204 & RFC 8785)', () => {
  it('canonicalize() sorts keys alphabetically per RFC 8785 §3.2.3', () => {
    const obj = { z: 1, a: 2, m: { y: 'bar', b: 'foo' } };
    const expected = '{"a":2,"m":{"b":"foo","y":"bar"},"z":1}';
    assert.equal(canonicalize(obj), expected);
  });

  it('sha3_256 matches Node.js native crypto for empty input', () => {
    const expected = createHash('sha3-256').update(Buffer.alloc(0)).digest('hex');
    const computed = sha3_256(new Uint8Array(0));
    assert.equal(computed, expected);
  });

  it('sha3_256 matches Node.js native crypto for arbitrary payload', () => {
    const payload = Buffer.from('ScatterID-FIPS-204-ML-DSA-65-offline-test-payload-2026', 'utf-8');
    const expected = createHash('sha3-256').update(payload).digest('hex');
    const computed = sha3_256(new Uint8Array(payload));
    assert.equal(computed, expected);
  });

  it('verifyCredentialOffline() passes Level 1 for valid pre-image commitment', () => {
    const claim = { subject: 'Alice M. Chen', credentialType: 'CivilID' };
    const saltHex = '0123456789abcdef0123456789abcdef'; // 16 bytes = 32 hex

    const canonicalJson = canonicalize(claim);
    const saltBytes = Buffer.from(saltHex, 'hex');
    const claimBytes = Buffer.from(canonicalJson, 'utf-8');
    const expectedHash = createHash('sha3-256')
      .update(Buffer.concat([saltBytes, claimBytes]))
      .digest('hex');

    const cred = {
      credentialId: 'cred-alice-9920',
      rawClaim: claim,
      salt: saltHex,
      dataHash: expectedHash,
      signature: '00'.repeat(3309), // 3309 bytes standard ML-DSA-65
    };

    const result = verifyCredentialOffline(cred);
    assert.equal(result.level1Passed, true);
    assert.equal(result.computedHash, expectedHash);
    assert.equal(result.isStandardSignatureLength, true);
    assert.equal(result.signatureLength, 3309);
    assert.match(result.level2Notice, /not available offline/);
  });

  it('verifyCredentialOffline() detects tampering and fails Level 1 when claim is modified', () => {
    const claim = { subject: 'Alice M. Chen', credentialType: 'CivilID' };
    const saltHex = '0123456789abcdef0123456789abcdef';

    const canonicalJson = canonicalize(claim);
    const saltBytes = Buffer.from(saltHex, 'hex');
    const claimBytes = Buffer.from(canonicalJson, 'utf-8');
    const expectedHash = createHash('sha3-256')
      .update(Buffer.concat([saltBytes, claimBytes]))
      .digest('hex');

    const tamperedCred = {
      credentialId: 'cred-alice-9920',
      rawClaim: { subject: 'Mallory Altered', credentialType: 'CivilID' }, // tampered!
      salt: saltHex,
      dataHash: expectedHash,
    };

    const result = verifyCredentialOffline(tamperedCred);
    assert.equal(result.level1Passed, false);
    assert.notEqual(result.computedHash, expectedHash);
  });
});
