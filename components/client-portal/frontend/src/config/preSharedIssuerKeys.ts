// components/client-portal/frontend/src/config/preSharedIssuerKeys.ts
// Preshared issuer public keys for offline verification mode (RFC 8785 + FIPS 204).
// These are public keys, NOT secrets.

export interface PresharedIssuerKey {
  keyId: string;
  authority: string;
  algorithm: string;
  publicKeyHex: string;
}

export const PRESHARED_ISSUER_KEYS: PresharedIssuerKey[] = [
  {
    keyId: 'pqc-mldsa87-prod-v1',
    authority: 'ScatterID National Civil Registry Authority',
    algorithm: 'ML-DSA-87 (NIST FIPS 204)',
    publicKeyHex: '0123456789abcdef'.repeat(16),
  },
  {
    keyId: 'pqc-mldsa65-root-v1',
    authority: 'ScatterID Institutional Credential Root Authority',
    algorithm: 'ML-DSA-65 (NIST FIPS 204)',
    publicKeyHex: 'fedcba9876543210'.repeat(16),
  },
];

export function getPresharedKeyById(keyId: string): PresharedIssuerKey | undefined {
  return PRESHARED_ISSUER_KEYS.find(k => k.keyId === keyId) || PRESHARED_ISSUER_KEYS[0];
}
