// components/ops-dashboard-web/src/types/credential.ts

export type CredentialStatus = 'anchored' | 'revoked' | 'pending';

export interface CredentialClaim {
  credentialType?: string;
  subject?: string;
  fullName?: string;
  identifierNumber?: string;
  issuingAuthority?: string;
  effectiveYear?: number;
  [key: string]: unknown;
}

export interface CredentialRecord {
  id: string;
  credentialId?: string;
  dataHash: string;
  status: CredentialStatus;
  issuedAt: string;
  revokedAt?: string | null;
  revocationReason?: string | null;
  publicKeyId: string;
  signature?: string;
  salt?: string;
  rawClaim?: CredentialClaim;
  claim?: CredentialClaim;
  algorithm?: string;
  anchorTxId?: string;
}
