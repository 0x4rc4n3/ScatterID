# Project Engineering Plan: Multi-Tenant Architecture, Client SDK, & Separated Dashboards

This document outlines the proposed architectural layout and roadmap to transition the ScatterID platform from a single-tenant local prototype into a secure, multi-tenant enterprise-ready SaaS platform.

---

## 1. Directory & Workspace Structure (Monorepo Workspace)

To manage multiple frontend dashboards, shared client SDK libraries, and multi-tenant backend services, we will transition the repository into a Monorepo layout using **npm workspaces** or **Turborepo**. This maintains shared type definitions, config files, and testing tools while keeping application boundaries isolated.

```
/ScatterID/
├── apps/
│   ├── operator-console/       # Private admin panel (VPN only, container toggling, log audit)
│   │   ├── Dockerfile
│   │   └── src/
│   └── client-portal/          # Public web portal (Client signup, API key generation, billing status)
│       ├── Dockerfile
│       └── src/
├── packages/
│   ├── sdk-node/               # Node.js client SDK (packaged for npm)
│   │   ├── src/
│   │   └── package.json
│   └── sdk-browser/            # Web/Browser JS client SDK (packaged for ES Modules)
│       ├── src/
│       └── package.json
├── services/
│   ├── verification-api/       # Multi-tenant API Gateway
│   │   ├── Dockerfile
│   │   └── src/
│   ├── crypto-service/         # Post-Quantum KMS Crypto service
│   │   ├── Dockerfile
│   │   └── src/
│   └── shard-node/             # Storage node instance (multi-tenant SQLite directories)
│       ├── Dockerfile
│       └── src/
├── docker-compose.yml          # Multi-tenant network orchestration
└── package.json                # Monorepo workspace configuration
```

---

## 2. Multi-Tenant Database Layout (Storage Isolation)

To enforce ZTA guidelines regarding tenant isolation, the shard nodes will use a **Directory-per-Tenant** or **Database-per-Tenant** model for SQLite files. 

### Logical Data Flow Diagram
```mermaid
graph TD
    Client[Client Request + API Key] -->|HTTPS| Proxy[Nginx Reverse Proxy]
    Proxy -->|Forward| Gateway[Verification Gateway API]
    Gateway -->|Verify Key & Tenant ID| Redis[(Redis Auth & Quotas)]
    Gateway -->|Lookup Tenant ID| ShardGate[Shard Dispatcher]
    
    subgraph Shard Node 1 (SQLite Node Instance)
        DB_A[(tenant_a_node_1.db)]
        DB_B[(tenant_b_node_1.db)]
    end
    
    ShardGate -->|Query tenant_a| DB_A
    ShardGate -->|Query tenant_b| DB_B
```

* **Tenant Database Resolution**: 
  * The Verification Gateway maps the incoming Bearer API Key to a specific `tenant_id` cached in Redis.
  * When sending read/write operations to the Shard Storage Nodes, the Gateway appends a header: `X-Tenant-ID: <tenant_id>`.
  * The Shard Node receives `X-Tenant-ID` and dynamically opens the SQLite connection to: `/app/data/<tenant_id>_node_i.db`.
  * This guarantees that data for different clients is stored in entirely separate database files on disk.

---

## 3. API Key Management & Billing Pipeline

To support usage limits, rate limits, and billing, we introduce a fast caching layer and an asynchronous billing pipeline:

```
[Verification API Gateway]
           │
           ├── (Synchronous Auth Check) ──> [Redis Cache] (Quota check, rate limiter)
           │
           └── (Asynchronous Billing Event) ──> [Redis Stream / Queue]
                                                      │
                                                      ▼
                                            [Billing Aggregator]
                                                      │
                                                      ▼
                                            [Stripe / Lago SaaS Billing]
```

### Technical Workflow
1. **Authentication Check (Redis-backed)**:
   * Verification Gateway checks API keys against a Redis cache:
     * Key: `api_key:<hash_value>`
     * Value: `{ tenant_id: "t_1092", tier: "enterprise", quota_used: 1420, quota_limit: 100000 }`
   * Redis executes a sliding-window rate limit (e.g. max 10 requests/second).
2. **Asynchronous Metering Events**:
   * If authorized, the request proceeds. Upon completion, the Gateway publishes a billing event to a Redis Stream or RabbitMQ channel.
   * A standalone **Billing Aggregator** service consumes these messages, writes them to a billing database, and syncs them periodically with subscription platforms like Stripe.

---

## 4. Separated Dashboard Layout

We will isolate user operations by dividing the management interfaces:

### A. Operator Console (Internal Admin Tool)
* **Access Control**: Exposed strictly inside a private subnet (accessible only over VPN/Tailscale).
* **Target Audience**: Systems administrators and DevOps engineers.
* **Core Views**:
  * **Service Health Metrics**: Live ports status, container RAM/CPU, block heights.
  * **Failure Simulation Engine**: Panel to stop/start containers to audit cluster recovery.
  * **Auto-Healing Logs**: Log audits showing backfill events and shard checksum corrections.
  * **Global Tenant List**: List of active tenants, system bandwidth, and resource utilization.

### B. Client Portal (SaaS Tenant Console)
* **Access Control**: Publicly exposed via HTTPS with user logins (credentials + MFA).
* **Target Audience**: Corporate clients, developers, and integrations specialists.
* **Core Views**:
  * **API Key Manager**: Generate, rotate, and revoke client-specific API keys.
  * **Usage Charts**: Graphs showing total verifications, issuances, and latency.
  * **Billing Panel**: Card details, subscription plans, current unpaid usage balance.
  * **Developer Playground**: Interactive API documentation, test client credentials console, and webhooks configuration.

---

## 5. Client-Side SDK Design

The Client-Side SDK will be distributed as lightweight packages (`sdk-node` and `sdk-browser`) to hide raw HTTP payloads and offer type-safe execution.

### SDK Interface Blueprint (JavaScript/TypeScript Example)
```typescript
import { ScatterIDClient } from '@scatterid/sdk-node';

// Initialize the client securely using the client API key
const client = new ScatterIDClient({
  apiKey: process.env.SCATTERID_API_KEY,
  gatewayUrl: 'https://api.scatterid.com'
});

// 1. Issuing a new credential
const credentialRecord = await client.issueCredential({
  subject: 'did:scatterid:user-1234',
  role: 'Systems Audit Specialist',
  customClaims: {
    department: 'Cybersecurity Compliance'
  }
});
console.log(`Success! Credential anchored on-chain with ID: ${credentialRecord.credentialId}`);

// 2. Verifying an existing credential
const verificationResult = await client.verifyCredential(credentialRecord.credentialId);
if (verificationResult.valid) {
  console.log(`Signature and Shamir shares verified. Anchor Status: ${verificationResult.anchorStatus}`);
}
```

---

## 6. Phase 3 Transition Roadmap

We will implement this transition systematically:

```
┌───────────────────────────────────────┐
│ Phase 3.1: Monorepo Restructuring     │
│ - Configure npm workspaces            │
│ - Establish dynamic SQLite paths      │
└──────────────────┬────────────────────┘
                   │
                   ▼
┌───────────────────────────────────────┐
│ Phase 3.2: Auth & Rate Limiting       │
│ - Set up Redis caching instances      │
│ - Enforce client X-Tenant-ID headers  │
└──────────────────┬────────────────────┘
                   │
                   ▼
┌───────────────────────────────────────┐
│ Phase 3.3: Client SDK Development     │
│ - Write node & browser client packages│
│ - Wire SDK methods to Gateway endpoints│
└──────────────────┬────────────────────┘
                   │
                   ▼
┌───────────────────────────────────────┐
│ Phase 3.4: Dual Dashboard Release     │
│ - Build private Operator Console      │
│ - Deploy public Client Portal         │
└───────────────────────────────────────┘
```

---

## 7. Detailed Step-by-Step Implementation Checkpoints

Below is the step-by-step engineering execution plan containing checkpoints, code structural additions, and verification metrics.

### Checkpoint 1: Repository Restructuring & npm Workspaces Configuration
To support multiple client-facing frontends and local libraries in a single repository:

- [x] **1.1 Directory Relocation**:
  * Move the current `MVP` folder to `apps/client-portal`.
  * Move `components/project-dashboard` to `apps/operator-console`.
  * Move `components/verification-api` to `services/verification-api`.
  * Move `components/crypto` to `services/crypto-service`.
  * Move `components/shard-node` to `services/shard-node`.
  * Delete/clean up the legacy `components` folder.

- [x] **1.2 Monorepo Configuration**:
  * Create a root `package.json` to configure **npm workspaces**:
    ```json
    {
      "name": "scatterid-monorepo",
      "version": "1.0.0",
      "private": true,
      "workspaces": [
        "apps/*",
        "packages/*",
        "services/*"
      ],
      "scripts": {
        "dev": "npm run dev --workspaces --if-present",
        "build": "npm run build --workspaces --if-present",
        "test": "npm run test --workspaces --if-present"
      }
    }
    ```
  * Maintain shared config templates (`eslint`, `tsconfig`, and typescript declarations) under a shared folder `/packages/config`.

---

### Checkpoint 2: Database-per-Tenant Storage Isolation (Shard Nodes)
Enforcing Zero Trust isolation requires partitioning each tenant's SQLite storage securely on disk.

- [x] **2.1 Shard Node Header Enforcement**:
  * Modify `services/shard-node/server.js` to extract and validate the client tenant ID:
    ```javascript
    const tenantId = req.headers['x-tenant-id'];
    const tenantRegex = /^[a-zA-Z0-9_\-]+$/;
    if (!tenantId || !tenantRegex.test(tenantId)) {
      return res.status(400).json({ error: "Missing or malformed X-Tenant-ID header" });
    }
    ```
- [x] **2.2 Lazy SQLite Connection Pool**:
  * Implement an active database manager in `shard-node/server.js` to open and cache tenant connections:
    ```javascript
    const activeDbPool = new Map();
    function getTenantDb(tenantId) {
      if (activeDbPool.has(tenantId)) return activeDbPool.get(tenantId);
      
      const safeTenantPath = path.join(DATA_DIR, `${tenantId}_node_${NODE_INDEX}.db`);
      const db = new Database(safeTenantPath);
      // Initialize tables in the newly generated database file
      initDbSchema(db);
      activeDbPool.set(tenantId, db);
      return db;
    }
    ```
- [x] **2.3 Gateway Header Propagation**:
  * Update `services/verification-api/src/db/models.js` and `routes/verify.js` to query the authentication context to obtain `tenant_id`.
  * Set `X-Tenant-ID` as a mandatory header in all outgoing container network calls to the 5 shard nodes.

---

### Checkpoint 3: Synchronous Auth Caching & Sliding Rate Limiter (Redis)
Integrating Redis to manage API key authorization lookups and sliding-window rate limiting in the Gateway.

- [x] **3.1 Redis Docker Integration**:
  * Append Redis service to `docker-compose.yml` exposing port `6379`.
- [x] **3.2 API Key Verification Middleware**:
  * Implement cache lookup in `services/verification-api/src/middleware/auth.js`:
    * Query Redis key `api_key:<hashed_token>`.
    * If cache miss, query base DB, compute SHA-256 hash, and populate Redis key with expiration TTL (e.g. 5 minutes).
- [x] **3.3 Sliding Window Rate Limiting (Lua Scripting)**:
  * Execute rate-limit evaluation directly in Redis to avoid race conditions:
    ```lua
    local key = KEYS[1]
    local now = tonumber(ARGV[1])
    local window = tonumber(ARGV[2])
    local limit = tonumber(ARGV[3])
    redis.call('zremrangebyscore', key, 0, now - window)
    local current = redis.call('zcard', key)
    if current < limit then
      redis.call('zadd', key, now, now)
      redis.call('expire', key, window)
      return 1
    else
      return 0
    end
    ```

---

### Checkpoint 4: Asynchronous Metering Event Pipeline & Aggregation
To prevent slow network pipelines and billing database calls from blocking the synchronous verification flow.

- [x] **4.1 Event Streaming Producer**:
  * Write a publisher helper in `verification-api` to push a record to a Redis Stream on request completion:
    ```javascript
    await redisClient.xAdd('verification_events', '*', {
      tenantId: req.tenantId,
      action: 'verify',
      timestamp: Date.now().toString()
    });
    ```
- [x] **4.2 Metering Aggregator Service**:
  * Create `services/billing-aggregator` containing an event consumer loop.
  * Dynamically read stream batches using Redis Consumer Groups (`XREADGROUP`).
  * Process aggregates, update database totals, and trigger webhooks to billing endpoints (e.g., Stripe Metered Billing API).

---

### Checkpoint 5: Client-Side SDK (Node.js & Browser Modules)
Packaging access methods into official SDK packages for distribution.

- [ ] **5.1 Node.js SDK (`packages/sdk-node`)**:
  * Implement the `ScatterIDClient` class in TypeScript.
  * Bundle using `esbuild` or `tsup` targeting both CommonJS and ES Modules.
  * Standardize request signatures using HTTPS and Bearer auth headers.
- [ ] **5.2 Browser SDK (`packages/sdk-browser`)**:
  * Implement verification queries targeting browser context.
  * Restrict browser access to **read-only verification routes** (issuance operations which expose signing keys should never run client-side in the browser).

---

### Checkpoint 6: Private VPN Operator Console & SaaS Client Portal
Building separate frontend portals matching specific user access criteria.

- [x] **6.1 Operator Console (`apps/operator-console`)**:
  * Build diagnostic interfaces with Tailwind CSS and Next.js / Express.
  * Integrate Docker socket connection to support manual shard container controls.
  * Include autologous delta log parsers.
- [ ] **6.2 SaaS Client Portal (`apps/client-portal`)**:
  * Standardize OIDC (Google/GitHub oauth) and credentials authentication.
  * Render real-time usage charts and token control configurations.
  * Offer billing subscription management interfaces.
