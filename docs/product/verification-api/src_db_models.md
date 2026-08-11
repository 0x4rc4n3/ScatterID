# Component Technical Specification: models.js (Verification API Database Client)

## 1. Purpose & Core Responsibility
- Manages the local SQLite database client fallback nodes and interfaces with distributed shard nodes.
- Dispatches shards to remote nodes, updates state status, retrieves shards, and runs healing audits.
- Implements dynamic client storage partitioning using tenant-isolated databases on disk.

## 2. Inbound & Outbound Communication Whitelist
- **Allowed Inbound (Who can talk TO this file):** 
    - Routes handlers (`issue.js`, `status.js`, `verify.js`) via JavaScript imports.
- **Explicitly Denied Inbound:** 
    - Direct network queries.
- **Allowed Outbound (Who this file can talk TO):** 
    - Dynamic tenant SQLite databases (`<tenant_id>_node_1.db` to `<tenant_id>_node_5.db`) on the filesystem.
    - Shard Nodes (`http://shard-node-1:3000` to `http://shard-node-5:3000`) via HTTP requests, authorized with Bearer tokens and `X-Tenant-ID` routing headers.
- **Explicitly Denied Outbound:** 
    - All other external TCP/HTTP endpoints.

## 3. Function & Method Manifest
- **`getTenantLocalNodes(tenantId)`**
    - **Purpose:** Dynamic connection manager that lazily resolves, opens, initializes, and caches tenant-specific local fallback SQLite connections and prepared statements.
    - **Inputs & Sanitization:** `tenantId` (string).
    - **Outputs:** Array of nodes containing `{ db, stmts }`.

- **`createCredential(record, shares, tenantId)`**
    - **Purpose:** Stores the credential metadata in tenant-isolated databases locally and dispatches the split shares to the respective shard storage nodes under the tenant's header partition.
    - **Inputs & Sanitization:** `record` (metadata structure), `shares` (array of formatted share strings), and `tenantId` (string).
    - **Outputs:** Dispatch report detailing communication state of each node.
    - **Error States & Handling:** Catches node dispatch failures and marks status accordingly.

- **`getCredentialById(id, tenantId)`**
    - **Purpose:** Queries local SQLite fallback tenant database nodes or queries remote tenant shard nodes for a credential metadata record.
    - **Inputs & Sanitization:** `id` (must match UUID v4 format checked by caller) and `tenantId` (string).
    - **Outputs:** Credential metadata object.

- **`getSharesByCredentialId(id, tenantId)`**
    - **Purpose:** Queries remote tenant shard nodes (with local fallback) to retrieve stored shares for a credential.
    - **Inputs & Sanitization:** `id` (UUID v4 format) and `tenantId` (string).
    - **Outputs:** Array of shares.

- **`healShards(nodeId, tenantId)`**
    - **Purpose:** Audit-compares stored data across database nodes under a specific tenant's context to restore corrupted or missing shards on a specific node.
    - **Inputs & Sanitization:** `nodeId` (integer between 1 and 5) and `tenantId` (string).
    - **Outputs:** Array of healed event reports.

- **`getAllCredentials(tenantId)`**
    - **Purpose:** Retrieves all credential records from the tenant's SQLite databases.
    - **Inputs & Sanitization:** `tenantId` (string).
    - **Outputs:** Array of credentials.

## 4. Security & Compliance Posture
- Enforces mandatory API authorization keys on startup to prevent unauthenticated shard node queries.
- Propagates `X-Tenant-ID` headers to prevent cross-tenant partition bypass attempts.
- Employs strict parameterized statements to prevent SQLite injection attacks.
