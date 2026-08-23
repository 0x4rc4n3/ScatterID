# Component Technical Specification: server.js (Shard Node)

## 1. Purpose & Core Responsibility
- Serves as the microservice application server for individual Distributed Shard Storage Nodes.
- Provides REST APIs to store, retrieve, update, and monitor Shamir Secret Sharing fragments (shards) securely.
- Manages an isolated local SQLite database per shard node for absolute separation of zero-trust states.

## 2. Inbound & Outbound Communication Whitelist
- **Allowed Inbound (Who can talk TO this file):** 
  - Verification API Gateway (`verification-api`) via HTTP on Port 3000, authorized using Bearer tokens (`SHARD_NODE_API_KEY`).
- **Explicitly Denied Inbound:** 
  - All other callers and external connection routes.
- **Allowed Outbound (Who this file can talk TO):** 
  - Local SQLite database file (`node_[NODE_INDEX].db`).
- **Explicitly Denied Outbound:** 
  - All external outbound HTTP/TCP connections.

## 3. Function & Method Manifest
- **`authenticateInterService(req, res, next)`**
  - **Purpose:** Enforces inter-service authorization token presence and matches it against `SHARD_NODE_API_KEY`.
  - **Inputs & Sanitization:** Authorization header. Validated to be string starts with `Bearer `.
  - **Outputs:** Calls next middleware or returns HTTP 401/403.
  - **Error States & Handling:** Rejects with sanitized error messages.

- **`POST /shard`**
  - **Purpose:** Accepts and stores a single Shamir share fragment and the associated credential metadata record.
  - **Inputs & Sanitization:** 
    - `record.id`: Must be a valid UUID v4 format.
    - `share`: Must match the strict regular expression `/^[1-5]-[0-9a-f]+(:[0-9a-f]+)?$/i`.
  - **Outputs:** JSON confirmation payload.
  - **Error States & Handling:** Catches constraints violations or filesystem issues, logs details internally, and returns generic `Internal Server Error` (HTTP 500) to clients.

- **`GET /shard/:credentialId`**
  - **Purpose:** Retrieves a stored shard value and metadata for a specific credential ID.
  - **Inputs & Sanitization:** `credentialId` (validated as UUID v4 format).
  - **Outputs:** JSON payload containing the credential metadata and target share.
  - **Error States & Handling:** SQL exceptions are masked; returns `Internal Server Error` (HTTP 500).

- **`POST /update-status`**
  - **Purpose:** Updates anchor status and transaction details for a stored credential.
  - **Inputs & Sanitization:** 
    - `credentialId`: Must be UUID v4 format.
    - `status`: Must be one of `['pending', 'anchored', 'failed', 'revoked']`.
    - `anchorTxId`: If provided, must match a 64-character hexadecimal regex.
  - **Outputs:** Success status.
  - **Error States & Handling:** Operations failures are masked with generic response formats.

- **`GET /integrity`**
  - **Purpose:** Evaluates database health by comparing calculated SHA3-256 hashes of stored shares against their recorded hashes.
  - **Inputs & Sanitization:** N/A.
  - **Outputs:** JSON health audit report.
  - **Error States & Handling:** Catches query errors and returns generic response.

## 4. Security & Compliance Posture
- Enforces mandatory API authorization keys on startup.
- Employs strict regular expression input filters to defend against local SQLite injection vectors.
- Implements error masking to ensure no stack traces or schema structures are disclosed to clients.
