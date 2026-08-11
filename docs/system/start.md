# Component Technical Specification: start.sh

## 1. Purpose & Core Responsibility
- Acts as the master orchestrator script for the ScatterID stack startup.
- Coordinates certificates checks, local blockchain network boot, Vault AppRole credential creation, configuration mappings, and microservices docker stack deployment.

## 2. Inbound & Outbound Communication Whitelist
- **Allowed Inbound (Who can talk TO this file):** 
  - Host terminal shell via manual operator triggers.
- **Explicitly Denied Inbound:** 
  - External network calls.
- **Allowed Outbound (Who this file can talk TO):** 
  - `services/blockchain/fabric-network/start.sh` script.
  - Docker daemon CLI and Docker Compose CLI.
  - Vault container CLI commands.
- **Explicitly Denied Outbound:** 
  - Direct external networks.

## 3. Function & Method Manifest
- **Execution Workflow:**
  1. Validates that the Docker daemon is running and reachable.
  2. Runs certificate validation and checks for local TLS keys.
  3. Launches the Hyperledger Fabric container network.
  4. Provisions HashiCorp Vault access controls:
     - Mounts `approle` authentication path.
     - Registers standalone policy from `issuer-policy.hcl`.
     - Configures the `issuer-role` client role.
     - Retrieves role IDs and secret IDs.
  5. Mounts configuration files read-only (`config.json`) and starts Flask, Express, and Sqlite microservices.
  6. Executes a health check probe loop validating service availability on ports 5001, 3000, and 4000.

## 4. Security & Compliance Posture
- Configures Vault AppRole dynamically, avoiding storage of credentials in repository environment files.
- Mounts configurations as read-only.
