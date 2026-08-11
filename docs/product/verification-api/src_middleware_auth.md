# Component Technical Specification: auth.js (Authentication & Rate Limiting Middleware)

## 1. Purpose & Core Responsibility
- Intercepts incoming HTTP requests to validate Bearer API keys against active tenant profiles.
- Leverages Redis to cache keys lookups and execute atomic Lua sliding-window rate limit checks.

## 2. Inbound & Outbound Communication Whitelist
- **Allowed Inbound (Who can talk TO this file):** 
    - API router (`server.js`) on routes requiring authorization.
- **Explicitly Denied Inbound:** 
    - Direct network or client queries.
- **Allowed Outbound (Who this file can talk TO):** 
    - Redis Cache container (`redis://redis:6379`).
    - Gateway System Keys model (`db/keys.js`).
- **Explicitly Denied Outbound:** 
    - Unauthenticated networks.

## 3. Function & Method Manifest
- **`authenticateApiKey(req, res, next)`**
    - **Purpose:** Enforces token verification, quota limit checks, and sliding window rate limiting.
    - **Inputs & Sanitization:** 
        - `req.headers.authorization` (validated to start with `Bearer `).
    - **Outputs:** Sets `req.tenantId` and calls `next()`, or returns HTTP 401/403/429.

## 4. Security & Compliance Posture
- Hashes API keys using SHA-256 before caching or lookups to prevent plain-text leakages in memory/cache logs.
- Uses Redis Lua scripting to execute sliding window rate-limiting atomically, defending against race conditions (concurrency attacks).
