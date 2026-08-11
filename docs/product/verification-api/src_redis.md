# Component Technical Specification: redis.js (Shared Redis Connection Client)

## 1. Purpose & Core Responsibility
- Acts as the central lifecycle manager for the Redis TCP connection.
- Offers shared methods to verify connectivity and publish metered billing events asynchronously.

## 2. Inbound & Outbound Communication Whitelist
- **Allowed Inbound (Who can talk TO this file):** 
    - Authentication middleware (`auth.js`), server setup (`server.js`), and routes controllers via JavaScript imports.
- **Explicitly Denied Inbound:** 
    - Direct network commands.
- **Allowed Outbound (Who this file can talk TO):** 
    - Redis Cache container (`redis://redis:6379`).
- **Explicitly Denied Outbound:** 
    - External networks.

## 3. Function & Method Manifest
- **`connectRedis()`**
    - **Purpose:** Opens and initializes the active TCP socket to Redis.
- **`isRedisConnected()`**
    - **Purpose:** Verifies connection status.
    - **Outputs:** Boolean.
- **`publishBillingEvent(tenantId, action)`**
    - **Purpose:** Asynchronously pushes billing event structures (`tenantId`, `action`, `timestamp`) onto the `verification_events` Redis Stream.
    - **Inputs & Sanitization:** `tenantId` (string), `action` (string).
    - **Outputs:** Promise resolving after command execution.

## 4. Security & Compliance Posture
- Defensively catches connection errors to prevent server failures when Redis is offline.
