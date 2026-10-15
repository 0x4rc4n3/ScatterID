import canonicalize from 'canonicalize';
import { sha3_256 } from 'js-sha3';

export interface HolderClaimBundle {
  version: 1;
  claim: Record<string, unknown>;
  salt: string;
  dataHash: string;
  requestId?: string;
  receiptToken?: string;
  credential?: Record<string, unknown>;
}

export function generateClaimantReceiptToken(): string {
  const random = new Uint8Array(32);
  globalThis.crypto.getRandomValues(random);
  return Array.from(random, byte => byte.toString(16).padStart(2, '0')).join('');
}

/** Compute the same commitment as ScatterIDClient.issue without sending the claim or salt. */
export function prepareClaimCommitment(claim: Record<string, unknown>): { dataHash: string; salt: string } {
  if (!claim || typeof claim !== 'object' || Array.isArray(claim)) throw new Error('Claim must be an object');
  const canonicalClaim = canonicalize(claim);
  if (!canonicalClaim) throw new Error('Claim could not be canonicalized');
  const random = new Uint8Array(16);
  globalThis.crypto.getRandomValues(random);
  const salt = Array.from(random, byte => byte.toString(16).padStart(2, '0')).join('');
  return { dataHash: computeClaimDataHash(canonicalClaim, salt), salt };
}

export function computeClaimDataHash(canonicalClaim: string, saltHex: string): string {
  if (!/^[0-9a-f]{32}$/i.test(saltHex)) throw new Error('Salt must be a 32-character hexadecimal value');
  const saltBytes = Uint8Array.from(saltHex.match(/.{2}/g) || [], byte => parseInt(byte, 16));
  const claimBytes = new TextEncoder().encode(canonicalClaim);
  const payload = new Uint8Array(saltBytes.length + claimBytes.length);
  payload.set(saltBytes, 0);
  payload.set(claimBytes, saltBytes.length);
  return sha3_256(payload);
}

export function downloadHolderBundle(bundle: HolderClaimBundle): void {
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `scatterid-holder-${bundle.requestId || 'claim'}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
