# Component Technical Specification: server.js (Billing Aggregator)

## 1. Purpose & Core Responsibility
- Acts as a background worker daemon that consumes metered events from the Redis `verification_events` stream.
- Increments client quota records in the master system keys database (`gateway_system.db`).

## 2. Inbound & Outbound Communication Whitelist
- **Allowed Inbound (Who can talk TO this file):** 
    - N/A (runs as an autonomous consumer daemon).
- **Explicitly Denied Inbound:** 
    - N/A.
- **Allowed Outbound (Who this file can talk TO):** 
    - Redis Stream (`redis://redis:6379`).
    - SQLite database file `gateway_system.db`.
- **Explicitly Denied Outbound:** 
    - External endpoints.

## 3. Function & Method Manifest
- **`startAggregator()`**
    - **Purpose:** Connects to Redis and boots the infinite consumer group reader loop.
- **`updateQuotaUsed(tenantId)`**
    - **Purpose:** Runs a safe parameterized SQL update to increment `quota_used` for the target tenant by 1.
    - **Inputs & Sanitization:** `tenantId` (string).
    - **Outputs:** Database write state.

## 4. Security & Compliance Posture
- Evaluates event metrics strictly in a background container. Does not expose external network interfaces (ports are blocked).
- Uses parameterized update queries to prevent SQL injections.
