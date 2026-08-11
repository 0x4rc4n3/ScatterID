# ScatterID Detailed Setup & Customer Operations Guide

This guide provides step-by-step instructions for deploying, configuring, and operating the ScatterID post-quantum sharded credential verification infrastructure for custom enterprise deployments.

---

## 📋 Table of Contents
1. [Prerequisites & System Audit](#1-prerequisites--system-audit)
2. [Customer Environment Customization](#2-customer-environment-customization)
3. [TLS & Certificate Management](#3-tls--certificate-management)
4. [Stack Orchestration & Startup](#4-stack-orchestration--startup)
5. [End-to-End Test Suite Execution](#5-end-to-end-test-suite-execution)
6. [API Usage & Integration Examples](#6-api-usage--integration-examples)
7. [5-Node Shard Matrix & Integrity Probing](#7-5-node-shard-matrix--integrity-probing)

---

## 1. Prerequisites & System Audit

ScatterID containerizes all language runtimes (Python 3.13, Node 24, Go 1.24) and native C/C++ compilation bindings (`liboqs`, `better-sqlite3`).

### Single Host Dependency:
- **Docker Engine (v24.0+)** with **Docker Compose (v2.20+)**.

### Run Automated Dependency Auditor & Auto-Installer:
```bash
# Audit system dependencies
./scripts/check_deps.sh

# Automatically install any missing host packages (Ubuntu / Debian / macOS / RHEL)
./scripts/check_deps.sh --install
```

---

## 2. Customer Environment Customization

Every customer-specific setting (API keys, custom domain URLs, exposed ports, Vault tokens, and Hyperledger Fabric parameters) is configured in `.env`.

### Step 1: Copy Environment Template
```bash
cp .env.example .env
```

### Step 2: Configure Customer Parameters (`.env`)

```ini
# ==========================================================
# 1. Security API Keys & Secrets (Customer Specific)
# ==========================================================
CRYPTO_SERVICE_API_KEY=customer-a-secret-bearer-key-999
VAULT_TOKEN=customer-a-vault-token-123

# ==========================================================
# 2. Custom Domain Endpoints & Ingress URLs
# ==========================================================
VERIFICATION_API_URL=https://api.customer-a.com
CRYPTO_SERVICE_URL=https://crypto-service:5001
VAULT_ADDR=http://vault:8200

# ==========================================================
# 3. Exposed Host Port Mappings (Customer Configurable)
# ==========================================================
PORT_VERIFICATION_API=3000
PORT_CRYPTO_SERVICE=5001
PORT_DASHBOARD=4000
PORT_VAULT=8200
PORT_SHARD_1=3001
PORT_SHARD_2=3002
PORT_SHARD_3=3003
PORT_SHARD_4=3004
PORT_SHARD_5=3005

# ==========================================================
# 4. Hyperledger Fabric Network & MSP Settings
# ==========================================================
FABRIC_PEER_ENDPOINT=peer0.issuer.scatterid.com:7051
FABRIC_PEER_HOST_ALIAS=peer0.issuer.scatterid.com
FABRIC_CHANNEL_NAME=scatterid-channel
FABRIC_CHAINCODE_NAME=scatterproof
FABRIC_MSP_ID=IssuerMSP
```

---

## 3. TLS & Certificate Management

ScatterID requires internal mutual TLS between `verification-api` and `crypto-service`.

### Option A: Auto-Generated Self-Signed Certificates (Default)
The startup script (`./scripts/start.sh`) automatically detects missing certificates and invokes `components/crypto/certs/generate_certs.sh` to generate SAN certificates for `crypto-service`, `verification-api`, `localhost`, and `127.0.0.1`.

### Option B: Custom Enterprise CA Certificates
To install custom customer CA certificates:
1. Copy your customer Root CA to `components/crypto/certs/ca.crt`.
2. Copy your domain certificate and private key to:
   - `components/crypto/certs/crypto-service.crt`
   - `components/crypto/certs/crypto-service.key`

---

## 4. Stack Orchestration & Startup

To launch the full 14-container microservice stack:

```bash
./scripts/start.sh
```

### What `start.sh` Performs:
1. Loads `.env` customer configuration.
2. Checks Docker Daemon availability.
3. Generates TLS certificates if missing.
4. Starts Hyperledger Fabric Network (Orderer 7050, Issuer Peer 7051, Verifier Peer 8051).
5. Invokes `docker compose up -d` to launch Vault, Crypto Service, Gateway, Control Dashboard, and 5 Shard Nodes.
6. Performs health probes on all HTTP/HTTPS endpoints.

---

## 5. End-to-End Test Suite Execution

To verify end-to-end cryptographic signing, Shamir fragmentation, Fabric ledger anchoring, and signature verification:

```bash
./scripts/test_all.sh
```

### Test Sequence:
1. **[1/5] Stack Sync**: Syncs application code and restarts verification gateway.
2. **[2/5] Crypto Service Audit**: Tests ML-DSA-65 `/package` signing and Vault `/rotate` key rotation.
3. **[3/5] Verification Gateway Audit**: Submits `POST /issue` and `POST /verify`.
4. **[4/5] Control Dashboard Audit**: Executes full E2E smoke test suite on port 4000.
5. **[5/5] Python Unit Tests**: Runs `pytest` suite for fragmentation and secret sharing modules.

---

## 6. API Usage & Integration Examples

### A. Issuing a Sharded Credential (`POST /issue`)

```bash
curl -X POST http://localhost:3000/issue \
  -H "Content-Type: application/json" \
  -d '{
    "student": "Alice Smith",
    "degree": "Master of Science in Cybersecurity",
    "timestamp": "2026-08-09T12:00:00Z"
  }'
```

#### Response:
```json
{
  "status": "anchored",
  "credentialId": "4bcf4279-b6db-48a4-bd73-d3050715da5a",
  "anchorTxId": "0df0fa3b550aef3fd5c4c27dee7858e9cc8161a22f3059cb0c6a191db7d9e443"
}
```

---

### B. Verifying a Credential (`POST /verify`)

```bash
curl -X POST http://localhost:3000/verify \
  -H "Content-Type: application/json" \
  -d '{
    "credentialId": "4bcf4279-b6db-48a4-bd73-d3050715da5a"
  }'
```

#### Response:
```json
{
  "valid": true,
  "anchorStatus": "active",
  "issuedAt": "2026-08-09T11:40:39.061633+00:00"
}
```

---

### C. Triggering Key Rotation (`POST /rotate`)

```bash
curl -X POST https://localhost:5001/rotate \
  --insecure \
  -H "Authorization: Bearer dev-secret-key-123"
```

#### Response:
```json
{
  "message": "Keys rotated successfully",
  "public_key_len": 1952
}
```

---

## 7. 5-Node Shard Matrix & Integrity Probing

Inspect real-time health and SHA3-256 integrity across all 5 isolated database containers:

```bash
curl -s http://localhost:4000/api/shards/integrity
```

#### Sample Response:
```json
{
  "success": true,
  "nodes": [
    { "nodeId": 1, "dbName": "shard-node-1", "path": "http://shard-node-1:3000/health", "sizeBytes": 57344, "totalShares": 3, "status": "HEALTHY", "integrityCheck": "VALID" },
    { "nodeId": 2, "dbName": "shard-node-2", "path": "http://shard-node-2:3000/health", "sizeBytes": 57344, "totalShares": 3, "status": "HEALTHY", "integrityCheck": "VALID" },
    { "nodeId": 3, "dbName": "shard-node-3", "path": "http://shard-node-3:3000/health", "sizeBytes": 57344, "totalShares": 3, "status": "HEALTHY", "integrityCheck": "VALID" },
    { "nodeId": 4, "dbName": "shard-node-4", "path": "http://shard-node-4:3000/health", "sizeBytes": 57344, "totalShares": 3, "status": "HEALTHY", "integrityCheck": "VALID" },
    { "nodeId": 5, "dbName": "shard-node-5", "path": "http://shard-node-5:3000/health", "sizeBytes": 57344, "totalShares": 3, "status": "HEALTHY", "integrityCheck": "VALID" }
  ]
}
```
