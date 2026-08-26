# Component Technical Specification: server.js (Project Dashboard)

## 1. Purpose & Core Responsibility
- Implements the Node.js Express application backend for the Operator Diagnostics & Analytics Dashboard.

## 2. Inbound & Outbound Communication Whitelist
- **Allowed Inbound (Who can talk TO this file):** 
  - Operators and diagnostics clients via HTTP on Port 4000.
- **Explicitly Denied Inbound:** 
  - All other external connections.
- **Allowed Outbound (Who this file can talk TO):** 
  - Verification API Gateway (`http://verification-api:3000`) via HTTP requests.
  - Local fallback SQLite database files (`node_[i].db` and `credentials.db`) via read-only `better-sqlite3` operations.
  - Docker daemon CLI wrapper (for stopping/starting nodes and logs auditing).
- **Explicitly Denied Outbound:** 
  - External unauthenticated networks.

## 3. Function & Method Manifest
- **`POST /api/verify`**
  - **Purpose:** Proxies verify requests to the verification-api gate.
  - **Inputs & Sanitization:** `credentialId` (validated via UUID v4 regex format).
  - **Outputs:** Verification result JSON payload.
  - **Error States & Handling:** Connection errors are caught, logged, and return masked generic responses.

- **`GET /api/status`**
  - **Purpose:** Probes network TCP ports and runs `docker ps` checks to determine container availability.
  - **Inputs & Sanitization:** N/A.
  - **Outputs:** Status dictionary mapping crypto service, verification API, and Hyperledger Fabric nodes.

- **`POST /api/shards/toggle-container`**
  - **Purpose:** Controls container status to test cluster fault tolerance.
  - **Inputs & Sanitization:** 
    - `nodeName` (must resolve to one of whitelisted valid containers).
    - `action` (must be `stop` or `start`).
  - **Outputs:** Toggled confirmation message and auto-healing sync reports.
  - **Error States & Handling:** Any out-of-whitelist node targets throw immediate bad parameter errors to block shell injection.

- **`GET /api/credentials/:id`**
  - **Purpose:** Queries local fallback SQLite node files for a detailed record.
  - **Inputs & Sanitization:** `id` (must match strict UUID v4 regex format).
  - **Outputs:** Credential details and list of hashes/checksums of SSS shards.
  - **Error States & Handling:** SQLite and fs exceptions return masked generic errors.

- **`POST /api/diagnostics/run`**
  - **Purpose:** Performs E2E system smoke tests (verifying ports, calling `/issue`, checking `/verify`).
  - **Inputs & Sanitization:** N/A.
  - **Outputs:** Step-by-step diagnostic test logs.

- **`GET /api/logs/:container`**
  - **Purpose:** Streams container standard output records.
  - **Inputs & Sanitization:** `container` (must be whitelisted).
  - **Outputs:** Text transcript of container stdout/stderr.

## 4. Security & Compliance Posture
- Enforces strict whitelisting on container names in shell commands to eliminate Command Injection vulnerabilities.
- Masks underlying query errors and connection exceptions to prevent service details disclosure.
- Restricts direct filesystem SQLite database fallback connections to read-only modes.
