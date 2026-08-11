# Component Technical Specification: package.json (Root)

## 1. Purpose & Core Responsibility
- Defines the root metadata and npm workspaces configuration for the ScatterID monorepo.
- Orchestrates packages and microservices under a single repository structure, maintaining workspace-level scripts.

## 2. Inbound & Outbound Communication Whitelist
- **Allowed Inbound (Who can talk TO this file):** 
  - Host execution shell (via npm CLI).
- **Explicitly Denied Inbound:** 
  - Any external execution requests or scripts.
- **Allowed Outbound (Who this file can talk TO):** 
  - Workspace directories (`apps/client-portal`, `apps/operator-console`, `services/verification-api`, `services/shard-node`, `services/billing-aggregator`).
- **Explicitly Denied Outbound:** 
  - External networks are blocked.

## 3. Function & Method Manifest
- **Workspaces Configured**:
  - `apps/client-portal` (Client web portal)
  - `apps/operator-console` (Operator console dashboard)
  - `services/verification-api` (Verification API gateway)
  - `services/shard-node` (Isolated shard database storage node)
- **Lifecycle Scripts**:
  - `dev:portal`: Boots client-portal development environment.
  - `build:portal`: Builds client-portal Next.js output.
  - `dev:console`: Boots operator-console dashboard server.
  - `dev:gateway`: Boots verification-api in development mode.
  - `dev:shard`: Boots shard-node in development mode.

## 4. Security & Compliance Posture
- Restricts deployment and execution scripts to local workspaces. No dependencies are managed directly at the root level to maintain boundary isolation.
