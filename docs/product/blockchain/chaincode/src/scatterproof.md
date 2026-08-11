# Component Technical Specification: scatterproof.go

## 1. Purpose & Core Responsibility
- Implements the Hyperledger Fabric Go smart contract (chaincode) to manage proof anchors on the ledger.
- Anchors credentials securely and enforces cryptographic verification of existences, statuses, and revokes directly inside the world state database.

## 2. Inbound & Outbound Communication Whitelist
- **Allowed Inbound (Who can talk TO this file):** 
  - Hyperledger Fabric Peer node execution context (`peer0.issuer.scatterid.com`, `peer0.verifier.scatterid.com`) via transaction simulation triggers.
  - Clients initiating transactions via the Fabric SDK gateway API, authorized by cryptographic certificates matching whitelisted MSP IDs.
- **Explicitly Denied Inbound:** 
  - Direct HTTP, TCP, or CLI connections outside the peer execution engine boundary.
- **Allowed Outbound (Who this file can talk TO):** 
  - Fabric Ledger World State database (State stub read/write APIs).
- **Explicitly Denied Outbound:** 
  - All other external connections.

## 3. Function & Method Manifest
- **`AnchorProof(ctx, credentialID, dataHash, issuerID, timestamp)`**
  - **Purpose:** Commits a new proof anchor record to the blockchain.
  - **Inputs & Sanitization:** 
    - `credentialID`: String. Sanitized via strict UUID v4 regular expression match.
    - `dataHash`: String. Sanitized via strict 64-character hexadecimal regex match (SHA3-256).
    - `issuerID`: String. Non-empty string up to 256 characters.
    - `timestamp`: String. Non-empty string up to 64 characters.
  - **Outputs:** Nil error on success.
  - **Error States & Handling:** 
    - Fails if client MSP is not `IssuerMSP` (HTTP 403 / Access Denied).
    - Fails if the credential ID already has an anchor on the ledger.
    - Returns descriptive ledger errors to the calling peer.

- **`QueryProof(ctx, credentialID)`**
  - **Purpose:** Fetches the anchor record state of a given credential ID.
  - **Inputs & Sanitization:** `credentialID` (UUID v4 format validation).
  - **Outputs:** Pointer to `ProofRecord` containing `CredentialID`, `DataHash`, `IssuerID`, `Timestamp`, and `Status`.
  - **Error States & Handling:** Returns error if the record does not exist or if state read fails.

- **`RevokeProof(ctx, credentialID, requestingIssuerID)`**
  - **Purpose:** Marks an existing anchor record's status as `revoked`.
  - **Inputs & Sanitization:** 
    - `credentialID`: String (validated as UUID v4).
    - `requestingIssuerID`: String (validated as non-empty up to 256 characters).
  - **Outputs:** Nil error on success.
  - **Error States & Handling:** 
    - Fails if caller MSP is not `IssuerMSP`.
    - Fails if the original anchor issuer ID does not match `requestingIssuerID`.
    - Returns error if the proof is not found.

- **`ProofExists(ctx, credentialID)`**
  - **Purpose:** Determines if a proof record is active in the world state.
  - **Inputs & Sanitization:** `credentialID` (validated as UUID v4).
  - **Outputs:** Boolean, error.
  - **Error States & Handling:** Fails on world state query failures.

## 4. Security & Compliance Posture
- Implements ZTA role boundaries: only certificates matching `IssuerMSP` can mutate ledger state (`AnchorProof` and `RevokeProof`).
- Enforces strict input schema formats (regex matches) at the contract layer to prevent world state injection attacks.
