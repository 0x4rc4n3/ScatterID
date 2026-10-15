import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import canonicalize from 'canonicalize';
import { computeClaimDataHash, generateClaimantReceiptToken, prepareClaimCommitment } from '../src/utils/claimCommitment.ts';

describe('Claimant-side commitment preparation', () => {
  it('matches the SDK commitment format: SHA3-256(salt bytes || RFC 8785 claim)', () => {
    const claim = { z: 3, subject: 'holder-1', details: { b: true, a: 2 } };
    const canonicalClaim = canonicalize(claim);
    const salt = '00112233445566778899aabbccddeeff';
    const expected = createHash('sha3-256')
      .update(Buffer.concat([Buffer.from(salt, 'hex'), Buffer.from(canonicalClaim, 'utf8')]))
      .digest('hex');

    assert.equal(computeClaimDataHash(canonicalClaim, salt), expected);
  });

  it('prepares a valid 16-byte salt and commitment without sending private data', () => {
    const claim = { fullName: 'Holder Example', identifier: 'ID-1' };
    const prepared = prepareClaimCommitment(claim);
    const expected = createHash('sha3-256')
      .update(Buffer.concat([Buffer.from(prepared.salt, 'hex'), Buffer.from(canonicalize(claim), 'utf8')]))
      .digest('hex');

    assert.match(prepared.salt, /^[0-9a-f]{32}$/);
    assert.match(prepared.dataHash, /^[0-9a-f]{64}$/);
    assert.equal(prepared.dataHash, expected);
  });

  it('generates a fresh 32-byte hexadecimal claimant receipt token', () => {
    const first = generateClaimantReceiptToken();
    const second = generateClaimantReceiptToken();
    assert.match(first, /^[0-9a-f]{64}$/);
    assert.notEqual(first, second);
  });

  it('rejects malformed salt input', () => {
    assert.throws(() => computeClaimDataHash('{}', '1234'), /32-character hexadecimal/);
  });
});
