# Component Technical Specification: models.js (Verification API Database Client)

## 1. Purpose & Core Responsibility
- Manages the local SQLite database client fallback nodes and interfaces with distributed shard nodes.
- Dispatches shards to remote nodes, updates state status, retrieves shards, and runs healing audits.

## 2. Inbound & Outbound Communication Whitelist
- **Allowed Inbound (Who can talk TO this file):** 
  - Routes handlers (`issue.js`, `status.js`, `verify.js`) via JavaScript imports.
- **Explicitly Denied Inbound:** 
  - Direct network queries.
- **Allowed Outbound (Who this file can talk TO):** 
  - SQLite databases (`node_1.db` to `node_5.db`) on the filesystem.
  - Shard Nodes (`http://shard-node-1:3000` to `http://shard-node-5:3000`) via HTTP requests, authorized with Bearer tokens.
- **Explicitly Denied Outbound:** 
  - All other external TCP/HTTP endpoints.

## 3. Function & Method Manifest
- **`createCredential(record, shares)`**
  - **Purpose:** Stores the credential metadata locally and dispatches the split shares to the respective shard storage nodes.
  - **Inputs & Sanitization:** `record` (metadata structure) and `shares` (array of formatted share strings).
  - **Outputs:** Dispatch report detailing communication state of each node.
  - **Error States & Handling:** Catches node dispatch failures and marks status accordingly.

- **`getCredentialById(id)`**
  - **Purpose:** Queries local SQLite fallback node databases for a credential metadata record.
  - **Inputs & Sanitization:** `id` (must match UUID v4 format checked by caller).
  - **Outputs:** Credential metadata object.

- **`getSharesByCredentialId(id)`**
  - **Purpose:** Queries remote shard nodes (with local fallback) to retrieve stored shares for a credential.
  - **Inputs & Sanitization:** `id` (UUID v4 format).
  - **Outputs:** Array of shares.

- **`healShards(nodeId)`**
  - **Purpose:** Audit-compares stored data across database nodes to restore corrupted or missing shards on a specific node.
  - **Inputs & Sanitization:** `nodeId` (integer between 1 and 5).
  - **Outputs:** Array of healed event reports.

## 4. Security & Compliance Posture
- Enforces mandatory API authorization keys on startup to prevent unauthenticated shard node queries.
- Employs strict parameterized statements to prevent SQLite injection attacks.
