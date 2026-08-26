export interface ScatterIDClientOptions {
  /**
   * Base URL of the ScatterID Verification Gateway.
   * @default 'http://localhost:3000'
   */
  baseUrl?: string;

  /**
   * API Key for bearer token authentication against the Gateway.
   */
  apiKey?: string;

  /**
   * Set to true to sign all request payloads with HMAC-SHA256.
   * Requires options.apiKey to be set.
   * @default false
   */
  secureSigning?: boolean;

  /**
   * Network connection timeout in milliseconds.
   * @default 10000
   */
  timeoutMs?: number;

  /**
   * Maximum number of retry attempts for transient network failures.
   * @default 3
   */
  maxRetries?: number;

  /**
   * Initial delay in milliseconds before the first retry attempt.
   * @default 1000
   */
  retryDelayMs?: number;
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

export interface DispatchReportEntry {
  nodeId: number;
  shareIndex: number;
  containerUrl: string;
  httpStatus: string;
  localDbStatus: string;
  shareHash: string;
}

export interface IssueResponse {
  /**
   * Deployment status of the credential: 'anchored' or 'pending'.
   */
  status: 'anchored' | 'pending';

  /**
   * Unique UUID of the newly issued credential.
   */
  credentialId: string;

  /**
   * The cryptographic hash of the credential claim.
   */
  dataHash: string;

  /**
   * The post-quantum signature algorithm (e.g., 'ML-DSA-65').
   */
  algorithm: string;

  /**
   * The transaction ID of the anchor on the Hyperledger Fabric ledger (null if failed/pending).
   */
  anchorTxId: string | null;

  /**
   * Report of shard dispatch success across the threshold storage nodes.
   */
  dispatchReport: DispatchReportEntry[];

  /**
   * Sharding threshold metadata.
   */
  shares: {
    required: number;
    total: number;
  };
}

export interface VerifyResponse {
  /**
   * Whether the credential signature was successfully reconstructed and validated.
   */
  valid: boolean;

  /**
   * The ledger anchoring state: 'active', 'failed', or 'revoked'.
   */
  anchorStatus: 'active' | 'failed' | 'revoked';

  /**
   * ISO 8601 string of when the credential was originally issued.
   */
  issuedAt: string;

  /**
   * Reason for validation failure if valid is false.
   */
  reason?: string;
}

export interface StatusResponse {
  success: boolean;
  status: {
    id: string;
    dataHash: string;
    algorithm: string;
    anchorTxId: string | null;
    status: 'anchored' | 'pending' | 'failed' | 'revoked';
    issuedAt: string;
  };
  shards: {
    total: number;
    active: number;
    required: number;
    details: {
      nodeId: number;
      available: boolean;
      localHash: string | null;
    }[];
  };
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

export interface HealNodeResponse {
  success: boolean;
  events: {
    nodeId: number;
    healedShares: number;
    timestamp: string;
    logText: string;
  }[];
}
