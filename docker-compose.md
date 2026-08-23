# Component Technical Specification: docker-compose.yml

## 1. Purpose & Core Responsibility
- Defines and orchestrates multi-container service configurations for the ScatterID microservices stack.
- Manages dependencies, network routing bridges, volume paths, and environment settings.

## 2. Inbound & Outbound Communication Whitelist
- **Allowed Inbound (Who can talk TO this file):** 
  - Docker Compose CLI execution context.
- **Explicitly Denied Inbound:** 
  - N/A.
- **Allowed Outbound (Who this file can talk TO):** 
  - Docker Engine daemon.
- **Explicitly Denied Outbound:** 
  - N/A.

## 3. Function & Method Manifest
- **Service Configuration Schema:**
  - **`scatterid-vault`**: Provisioned on port 8200. Mounts persistent storage directories.
  - **`scatterid-crypto`**: Active Flask KMS gateway. Exposed on port 5001. Relies on TLS certificates mount and is dependent on `scatterid-vault`.
  - **`scatterid-verification`**: Active Express gateway. Exposed on port 3000. Relies on network proxy variables and is dependent on `scatterid-crypto` and shard nodes.
  - **`scatterid-dashboard`**: React console exposed on port 4000.
  - **`scatterid-shard-1` to `scatterid-shard-5`**: Five separate Node.js SQLite storage nodes, each exposed on separate containers with isolated data volumes.

## 4. Security & Compliance Posture
- Mounts global `config.json` configuration file as read-only (`:ro`) to prevent running containers from mutating orchestration mappings.
- Restricts container privileges by specifying custom environment contexts.
