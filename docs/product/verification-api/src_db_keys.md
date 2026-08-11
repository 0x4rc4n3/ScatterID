# Component Technical Specification: keys.js (Gateway System DB Client)

## 1. Purpose & Core Responsibility
- Manages the master `gateway_system.db` database containing authentication keys and tenant configuration records.
- Resolves plaintext API keys to their corresponding tenant profiles using secure SHA-256 hashes.

## 2. Inbound & Outbound Communication Whitelist
- **Allowed Inbound (Who can talk TO this file):** 
    - Authentication middleware (`auth.js`) via JavaScript imports.
- **Explicitly Denied Inbound:** 
    - Direct network or client queries.
- **Allowed Outbound (Who this file can talk TO):** 
    - SQLite database file `gateway_system.db`.
- **Explicitly Denied Outbound:** 
    - External connections.

## 3. Function & Method Manifest
- **`getTenantByKey(apiKey)`**
    - **Purpose:** Hashes the provided API key and queries the database for the tenant profile.
    - **Inputs & Sanitization:** `apiKey` (string).
    - **Outputs:** Tenant profile record `{ tenant_id, tier, quota_limit, quota_used }` or `null`.

- **`rotateTenantKey(tenantId)`**
    - **Purpose:** Generates a new random API key, updates its hash in the database, and returns both plaintext and hashed values.
    - **Inputs & Sanitization:** `tenantId` (string).
    - **Outputs:** `{ newKeyPlaintext, newKeyHashed }` or `null` on failure.

## 4. Security & Compliance Posture
- Hashes API keys on disk and in memory using SHA-256 to prevent plain-text leakages.
- Employs strict parameterized statements.
