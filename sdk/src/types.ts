export interface ScatterIDClientOptions {
  apiKey: string;
  issuanceUrl?: string;
  verificationUrl?: string;
}

export interface Claim {
  /**
   * The subject identifier (e.g. user UUID, email, or credential subject name).
   */
  subject: string;

  /**
   * Optional role associated with the credential subject.
   */
  role?: string;

  /**
   * Any additional structured properties.
   */
  [key: string]: any;
}

/**
 * Response from POST /issue.
 *
 * Fields match the object literal returned by issueRoute in
 * components/verification-api/src/routes/issue.js (lines 86-95).
 */
export interface IssueResponse {
  /** Deployment status: 'anchored', 'pending', or 'failed'. */
  status: 'anchored' | 'pending' | 'failed';

  /** Unique UUID of the newly issued credential. */
  credentialId: string;

  /** The SHA3-256 salted hash of the canonicalized claim. */
  dataHash: string;

  /** The post-quantum signature algorithm (e.g. 'ML-DSA-65'). */
  algorithm: string;

  /** Identifier of the public key used to sign, resolved from the key registry. */
  publicKeyId: string;

  /** The ML-DSA-65 signature over dataHash, hex-encoded. */
  signature: string;

  /** Transaction ID of the Fabric ledger anchor, or null if not yet anchored. */
  anchorTxId: string | null;

  /** ISO 8601 timestamp of when the credential was issued. */
  issuedAt: string;
}

/**
 * Response from POST /verify.
 *
 * Verification compares the caller-supplied dataHash against the stored hash,
 * checks the ML-DSA-65 signature via the crypto-service (resolving the public
 * key from the internal registry by publicKeyId), and confirms the Fabric
 * ledger anchor status. Nothing is reconstructed.
 *
 * Fields match the object literal returned by verifyRoute in
 * components/verification-api/src/routes/verify.js (lines 107-112).
 */
export interface VerifyResponse {
  /** Whether the hash matched, signature was valid, and anchor status is active. */
  valid: boolean;

  /** The ledger anchoring state (e.g. 'active', 'anchored', 'revoked', 'tampered_hash', 'missing_anchor'). */
  anchorStatus: string;

  /** ISO 8601 timestamp of when the credential was originally issued. */
  issuedAt: string;

  /** Reason for validation failure, present only when valid is false. */
  reason?: string;
}

/**
 * Response from GET /status/:id.
 *
 * Fields match the object literal returned by statusRoute in
 * components/verification-api/src/routes/status.js (lines 25-32).
 */
export interface StatusResponse {
  /** The credential UUID. */
  id: string;

  /** The SHA3-256 salted hash of the canonicalized claim. */
  dataHash: string;

  /** The signature algorithm used (e.g. 'ML-DSA-65'). */
  algorithm: string;

  /** Transaction ID of the Fabric ledger anchor, or null. */
  anchorTxId: string | null;

  /** Current credential status: 'anchored', 'pending', 'failed', or 'revoked'. */
  status: 'anchored' | 'pending' | 'failed' | 'revoked';

  /** ISO 8601 timestamp of when the credential was issued. */
  issuedAt: string;
}

export interface CredentialSummary {
  id: string;
  dataHash: string;
  algorithm: string;
  anchorTxId: string | null;
  status: string;
  issuedAt: string;
}

export interface ListCredentialsResponse {
  success: boolean;
  credentials: CredentialSummary[];
}
