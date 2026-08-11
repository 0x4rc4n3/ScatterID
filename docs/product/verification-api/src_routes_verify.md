# Component Technical Specification: verify.js (Verification API Route)

## 1. Purpose & Core Responsibility
- Manages HTTP POST requests to reconstruct and cryptographically verify claims using sharded data fragments.

## 2. Inbound & Outbound Communication Whitelist
- **Allowed Inbound (Who can talk TO this file):** 
    - Express app server routing table (`server.js`) on `/verify`, with optional `X-Tenant-ID` header.
- **Explicitly Denied Inbound:** 
    - N/A.
- **Allowed Outbound (Who this file can talk TO):** 
    - `crypto-service` HTTPS endpoint `/unpackage` on Port 5001.
    - Fabric client adapter `fabric.js` API methods.
    - SQLite database fallback layer `models.js` API methods (passing `tenantId`).
- **Explicitly Denied Outbound:** 
    - Unauthenticated network endpoints.

## 3. Function & Method Manifest
- **`verifyRoute(req, res)`**
    - **Purpose:** Entry routing controller for verification.
    - **Inputs & Sanitization:** 
        - `req.body.credentialId` (must match UUID v4 structure).
        - `req.headers['x-tenant-id']` (alphanumeric tenant identifier, defaults to `default-tenant`).
    - **Outputs:** JSON object detailing signature validity, anchor status, issued timestamp, and optional failure reason.
    - **Error States & Handling:** Wraps the entire routing flow inside a global try-catch block. Communication errors to `crypto-service` are masked to generic error formats (e.g. `Cryptographic authority unreachable`), with trace output written to server logs.

## 4. Security & Compliance Posture
- Verifies integrity hashes of all retrieved shard components before sending them to the reconstruction endpoint.
- Masks external microservice connection issues from verification client responses.
- Restricts database queries to the requesting tenant's partition space.
