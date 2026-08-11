# Component Technical Specification: issue.js (Verification API Route)

## 1. Purpose & Core Responsibility
- Manages HTTP POST request execution to package, sign, shard, store, and blockchain-anchor a new credential claim.

## 2. Inbound & Outbound Communication Whitelist
- **Allowed Inbound (Who can talk TO this file):** 
    - Express app server routing table (`server.js`) on `/issue`, with optional `X-Tenant-ID` header.
- **Explicitly Denied Inbound:** 
    - N/A.
- **Allowed Outbound (Who this file can talk TO):** 
    - `crypto-service` HTTPS endpoint `/package` on Port 5001.
    - Fabric client adapter `fabric.js` API methods.
    - SQLite database fallback layer `models.js` API methods (passing `tenantId`).
- **Explicitly Denied Outbound:** 
    - Direct database or external unauthenticated networks.

## 3. Function & Method Manifest
- **`issueRoute(req, res)`**
    - **Purpose:** Entry routing controller for credential issuance.
    - **Inputs & Sanitization:** 
        - `req.body.claim`: Struct. Verified type and structure.
        - `claim.subject` / `claim.role`: String. Sanitized of injection markers `<>'\"&;` and limited to 256 characters.
        - `req.headers['x-tenant-id']` (alphanumeric tenant identifier, defaults to `default-tenant`).
    - **Outputs:** JSON confirmation payload detailing record IDs, hashes, transaction information, and shard counts.
    - **Error States & Handling:** Encloses operations in a global try-catch block. Connection errors to `crypto-service` or database errors are masked to generic errors, while trace is logged to standard console streams.

## 4. Security & Compliance Posture
- Sanitize all claims inputs to protect local database systems and downstream components.
- Mask internal network errors to prevent service discovery disclosures.
- Restricts credential storage writes to the tenant's partition space.
