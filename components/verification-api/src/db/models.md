# Component Technical Specification: models.js (Verification API Database Client)

## 1. Purpose & Core Responsibility

## 2. Inbound & Outbound Communication Whitelist
- **Allowed Inbound (Who can talk TO this file):** 
  - Routes handlers (`issue.js`, `status.js`, `verify.js`) via JavaScript imports.
- **Explicitly Denied Inbound:** 
  - Direct network queries.
- **Allowed Outbound (Who this file can talk TO):** 
  - SQLite databases (`node_1.db` to `node_5.db`) on the filesystem.
- **Explicitly Denied Outbound:** 
  - All other external TCP/HTTP endpoints.

## 3. Function & Method Manifest
- **`createCredential(record, shares)`**
  - **Inputs & Sanitization:** `record` (metadata structure) and `shares` (array of formatted share strings).
  - **Outputs:** Dispatch report detailing communication state of each node.
  - **Error States & Handling:** Catches node dispatch failures and marks status accordingly.

- **`getCredentialById(id)`**
  - **Purpose:** Queries local SQLite fallback node databases for a credential metadata record.
  - **Inputs & Sanitization:** `id` (must match UUID v4 format checked by caller).
  - **Outputs:** Credential metadata object.

  - **Inputs & Sanitization:** `id` (UUID v4 format).
  - **Outputs:** Array of shares.

- **`healShards(nodeId)`**
  - **Inputs & Sanitization:** `nodeId` (integer between 1 and 5).
  - **Outputs:** Array of healed event reports.

## 4. Security & Compliance Posture
- Employs strict parameterized statements to prevent SQLite injection attacks.
