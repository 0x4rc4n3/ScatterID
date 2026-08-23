# Component Technical Specification: stop.sh (Hyperledger Fabric Network teardown)

## 1. Purpose & Core Responsibility
- Stops and prunes the running Hyperledger Fabric container nodes.
- Discards channel block files, container database volumes, and peer states.

## 2. Inbound & Outbound Communication Whitelist
- **Allowed Inbound (Who can talk TO this file):** 
  - Host master `stop.sh` script.
  - Manual shell executions in terminal.
- **Explicitly Denied Inbound:** 
  - N/A.
- **Allowed Outbound (Who this file can talk TO):** 
  - Docker Compose CLI engine.
- **Explicitly Denied Outbound:** 
  - External networks.

## 3. Function & Method Manifest
- **Execution Workflow:**
  1. Tears down Fabric peer and orderer containers using `docker compose down -v`.
  2. Prunes all associated Docker network bridges and container volumes.

## 4. Security & Compliance Posture
- Prunes Fabric state DB volumes on teardown to prevent residual configuration or credentials leaks.
