# Component Technical Specification: fabric.js (Hyperledger Fabric Client)

## 1. Purpose & Core Responsibility
- Acts as the connector client to the Hyperledger Fabric blockchain network.
- Anchors proof hashes on-chain and queries anchor states for credential verification.

## 2. Inbound & Outbound Communication Whitelist
- **Allowed Inbound (Who can talk TO this file):** 
  - Routes handlers (`issue.js`, `verify.js`) via JavaScript imports.
- **Explicitly Denied Inbound:** 
  - Direct network queries.
- **Allowed Outbound (Who this file can talk TO):** 
  - Hyperledger Fabric Peer node endpoint (Port 7051) via gRPC.
- **Explicitly Denied Outbound:** 
  - All other external connections.

## 3. Function & Method Manifest
- **`anchorProof(credentialId, dataHash, issuerId)`**
  - **Purpose:** Issues a transaction proposal to write proof anchor to the ledger.
  - **Inputs & Sanitization:** `credentialId` (UUID v4), `dataHash` (64-character hex), `issuerId` (string).
  - **Outputs:** Transaction ID.
  - **Error States & Handling:** Throws exception if peer returns commit failures.

- **`queryProof(credentialId)`**
  - **Purpose:** Evaluates a transaction query to retrieve stored ledger proof data.
  - **Inputs & Sanitization:** `credentialId` (UUID v4).
  - **Outputs:** Evaluated JSON ProofRecord from ledger.

- **`revokeProof(credentialId, issuerId)`**
  - **Purpose:** Issues transaction proposal to update ledger proof status to revoked.
  - **Inputs & Sanitization:** `credentialId` (UUID v4), `issuerId` (string).
  - **Outputs:** Updated ProofRecord JSON.

- **`proofExists(credentialId)`**
  - **Purpose:** Checks existence of proof anchor on-chain.
  - **Inputs & Sanitization:** `credentialId` (UUID v4).
  - **Outputs:** Boolean.

## 4. Security & Compliance Posture
- Connects using secure TLS configurations and organization-specific client certificate mappings.
- Cleanly closes client and gateway connections on exit.
