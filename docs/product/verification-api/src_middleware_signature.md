# Component Technical Specification: signature.js (HMAC Signature Middleware)

## 1. Purpose & Core Responsibility
- Validates the integrity and authenticity of requests by verifying HMAC-SHA256 signatures.
- Defends against replay attacks by tracking transaction nonces inside Redis and enforcing a 5-minute time drift threshold.

## 2. Inbound & Outbound Communication Whitelist
- **Allowed Inbound (Who can talk TO this file):** 
    - API router (`server.js`) on routes requiring signature checking.
- **Explicitly Denied Inbound:** 
    - N/A.
- **Allowed Outbound (Who this file can talk TO):** 
    - Redis Cache container (`redis://redis:6379`).
- **Explicitly Denied Outbound:** 
    - External networks.

## 3. Function & Method Manifest
- **`verifyHmacSignature(req, res, next)`**
    - **Purpose:** Checks for headers `X-Signature`, `X-Timestamp`, and `X-Nonce`, matches against cached nonces, and validates computed HMAC signature matching.
    - **Inputs & Sanitization:** 
        - `req.headers['x-signature']` (hex string).
        - `req.headers['x-timestamp']` (integer Unix timestamp).
        - `req.headers['x-nonce']` (alphanumeric string).
    - **Outputs:** Calls `next()` if valid, otherwise returns HTTP 400 or 401.

## 4. Security & Compliance Posture
- Employs `crypto.timingSafeEqual` for constant-time signature comparison to eliminate timing side-channel attacks.
- Enforces strict replay window protection (drift limited to $\pm 300$ seconds).
- Tracks nonces in Redis to prevent message re-transmission or double-execution.
