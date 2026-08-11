# Component Technical Specification: status.js (Verification API Route)

## 1. Purpose & Core Responsibility
- Manages HTTP GET requests to retrieve anchor status, data hash, signature, and timestamp of an issued credential.

## 2. Inbound & Outbound Communication Whitelist
- **Allowed Inbound (Who can talk TO this file):** 
  - Express app server routing table (`server.js`) on `/status/:id`.
- **Explicitly Denied Inbound:** 
  - N/A.
- **Allowed Outbound (Who this file can talk TO):** 
  - SQLite database fallback layer `models.js` API methods.
- **Explicitly Denied Outbound:** 
  - External networks.

## 3. Function & Method Manifest
- **`statusRoute(req, res)`**
  - **Purpose:** Entry routing controller for status check.
  - **Inputs & Sanitization:** `req.params.id` (must match UUID v4 structure).
  - **Outputs:** JSON object mapping credential metadata.
  - **Error States & Handling:** Database failures are wrapped in try-catch structures and masked as `Internal Server Error` (HTTP 500).

## 4. Security & Compliance Posture
- Restricts status queries to clean UUID v4 formats to block database injection.
- Masks internal query details to prevent database infrastructure leaks.
