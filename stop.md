# Component Technical Specification: stop.sh

## 1. Purpose & Core Responsibility
- Acts as the stack teardown orchestrator script.
- Stops all running container instances and cleans up state volumes for fresh restarts.

## 2. Inbound & Outbound Communication Whitelist
- **Allowed Inbound (Who can talk TO this file):** 
  - Host terminal shell via manual operator triggers.
- **Explicitly Denied Inbound:** 
  - External network calls.
- **Allowed Outbound (Who this file can talk TO):** 
  - `components/blockchain/fabric-network/stop.sh` script.
  - Docker daemon CLI and Docker Compose CLI.
- **Explicitly Denied Outbound:** 
  - All other external connections.

## 3. Function & Method Manifest
- **Execution Workflow:**
  1. Stops and prunes the microservice containers (KMS Vault, Crypto service, Verification API, Dashboard).
  2. Executes the blockchain network teardown script to stop peer/orderer containers.
  3. Prunes all associated Docker network bridges and database volume mounts.

## 4. Security & Compliance Posture
- Cleans and prunes dynamic database states and session volumes on shutdown to prevent storage residual leaks.
