// components/client-portal/frontend/src/types/verifyResult.ts

export type VerificationMode = 'live' | 'offline';

export interface LiveVerifyResult {
  mode: 'live';
  valid: boolean;
  anchorStatus: 'active' | 'anchored' | 'revoked' | 'tampered_hash' | 'ledger_unreachable' | string;
  issuedAt?: string;
  reason?: string;
  credentialId?: string;
  dataHash?: string;
}

export interface OfflineVerifyResult {
  mode: 'offline';
  level1Passed: boolean;
  computedHash: string;
  expectedHash: string;
  canonicalJson: string;
  saltHex: string;
  signatureLength?: number;
  isStandardSignatureLength?: boolean;
  publicKeyLength?: number;
  isStandardPublicKeyLength?: boolean;
  credentialId?: string;
  subject?: string;
  algorithm?: string;
  anchorTxId?: string;
  level2Notice: string;
  revocationNotice: string;
  error?: string;
}

export type VerifyResult = LiveVerifyResult | OfflineVerifyResult;
