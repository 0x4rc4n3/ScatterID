# Component Technical Specification: start.sh (Hyperledger Fabric Network startup)

## 1. Purpose & Core Responsibility
- Orchestrates certificates generation, channel creation, and ledger bootstrap for the Hyperledger Fabric container nodes.
- Packages and commits smart contracts (chaincode) to the active channel.

## 2. Inbound & Outbound Communication Whitelist
- **Allowed Inbound (Who can talk TO this file):** 
  - Host master `start.sh` script.
  - Manual shell executions in terminal.
- **Explicitly Denied Inbound:** 
  - N/A.
- **Allowed Outbound (Who this file can talk TO):** 
  - Hyperledger Fabric binary command tools (`cryptogen`, `configtxgen`, `peer`).
  - Docker Compose CLI engine.
- **Explicitly Denied Outbound:** 
  - External networks.

## 3. Function & Method Manifest
- **Execution Workflow:**
  1. Generates peer/orderer MSP certificates using `cryptogen.yaml` if not present.
  2. Runs configtxgen to construct channel artifacts and genesis block.
  3. Spins up the Fabric container nodes (orderer, peer0.issuer, peer0.verifier).
  4. Joins the orderer and peer nodes to the `scatterid-channel`.
  5. Packages the Go chaincode (`scatterproof`) from source directories.
  6. Installs, approves, and commits the chaincode definition on both organizations' nodes.

## 4. Security & Compliance Posture
- Configures TLS validation parameters (`CORE_PEER_TLS_ENABLED=true`) for all inter-peer communications.
- Restricts certificate generation access to native host executions.
