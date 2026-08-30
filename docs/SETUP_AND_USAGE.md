# ScatterID Setup & Usage Guide

This guide provides step-by-step instructions for deploying, configuring, and operating ScatterID's zero-knowledge, post-quantum credential verification infrastructure.

---

## 📋 Table of Contents
1. [Prerequisites](#1-prerequisites)
2. [Environment Configuration](#2-environment-configuration)
3. [TLS & Certificate Management](#3-tls--certificate-management)
4. [Stack Orchestration & Startup](#4-stack-orchestration--startup)
5. [End-to-End Test Suite](#5-end-to-end-test-suite)
6. [API Usage & Integration](#6-api-usage--integration)
7. [Operator Dashboard](#7-operator-dashboard)

---

## 1. Prerequisites

ScatterID containerizes all runtimes (Python 3.13, Node 24, Go 1.24) and native bindings (`liboqs`, `better-sqlite3`).

**Single host dependency:** Docker Engine (v24.0+) with Docker Compose (v2.20+).

```bash
# Audit system dependencies
./scripts/check_deps.sh

# Auto-install missing host packages
./scripts/check_deps.sh --install
```

---

## 2. Environment Configuration

All deployment settings are configured in `.env` (template in `.env.example`).

### Recommended: Automated 1-Command Bootstrap
```bash
# Turnkey provisioning: generates secure keys, certificates, and launches core stack
./scripts/quickstart.sh

# Launch full stack including the Web Operator Dashboard:
./scripts/quickstart.sh --with-dashboard
```

### Manual Configuration
If configuring manually:

#### Step 1: Copy Template
```bash
cp .env.example .env
```

#### Step 2: Configure Parameters (`.env`)

```ini
# Security API Keys & Secrets (generate using: openssl rand -hex 32)
CRYPTO_SERVICE_API_KEY=<your-crypto-service-bearer-key>
VERIFICATION_API_KEY=<your-verification-api-bearer-key>
GATEWAY_API_KEY=<your-dashboard-bearer-key>
REVOKE_API_KEY=<your-revoke-bearer-key>
VAULT_TOKEN=scatterid-vault-root-token

# Service Endpoints
VERIFICATION_API_URL=http://verification-api:3000
CRYPTO_SERVICE_URL=https://crypto-service:5001
VAULT_ADDR=http://vault.scatterid.com:8200

# Exposed Host Port Mappings
PORT_VERIFICATION_API=3000
PORT_CRYPTO_SERVICE=5001
PORT_DASHBOARD=4000
PORT_VAULT=8200

# Hyperledger Fabric Network
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
The startup script (`./scripts/start.sh`) auto-detects missing certs and invokes `components/crypto/certs/generate_certs.sh`.

### Option B: Custom Enterprise CA Certificates
1. Copy your Root CA to `components/crypto/certs/ca.crt`.
2. Copy your domain cert and key to:
   - `components/crypto/certs/crypto-service.crt`
   - `components/crypto/certs/crypto-service.key`

---

## 4. Stack Orchestration & Startup

```bash
# Start core backend (Crypto + Gateway + Fabric + Vault)
./scripts/start.sh

# Start with Web Operator Dashboard (Port 4000)
./scripts/start.sh --with-dashboard
```

**What `start.sh` performs:**
1. Loads `.env` configuration.
2. Checks Docker Daemon availability.
3. Generates TLS certificates if missing.
4. Starts Hyperledger Fabric Network (Orderer, Issuer Peer, Verifier Peer).
5. Launches Vault, Crypto Service, and Verification API Gateway (and Dashboard if requested).
6. Performs health probes on all service endpoints.

---

## 5. End-to-End Test Suite

```bash
./scripts/test_all.sh
```

### Test Sequence:
1. **[1/4] Stack Sync**: Syncs application code and restarts verification gateway.
2. **[2/4] Crypto Service**: Tests ML-DSA-65 `POST /sign_hash` and Vault key rotation.
3. **[3/4] Verification Gateway**: Submits `POST /issue` (dataHash + idempotencyKey) and `POST /verify` (dataHash + credentialId).
4. **[4/4] Control Dashboard**: Tests system status on port 4000.

---

## 6. API Usage & Integration

### A. Issuing a Credential (`POST /issue`)

The SDK computes `dataHash = SHA3-256(salt || RFC8785_canonicalize(claim))` client-side, then sends only the hash:

```bash
curl -X POST http://localhost:3000/issue \
  -H "Content-Type: application/json" \
  -d '{
    "dataHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "idempotencyKey": "unique-request-id-123"
  }'
```

#### Response:
```json
{
  "status": "anchored",
  "credentialId": "4bcf4279-b6db-48a4-bd73-d3050715da5a",
  "dataHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "algorithm": "ML-DSA-65",
  "publicKeyId": "a1b2c3d4e5f6",
  "signature": "...",
  "anchorTxId": "0df0fa3b550aef3fd5c4c27dee7858e9cc8161a22f3059cb0c6a191db7d9e443",
  "issuedAt": "2026-08-09T12:00:00.000Z"
}
```

> **Note:** The caller must store the `salt` used during hashing — ScatterID never sees or stores it.

---

### B. Verifying a Credential (`POST /verify`)

```bash
curl -X POST http://localhost:3000/verify \
  -H "Content-Type: application/json" \
  -d '{
    "dataHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "credentialId": "4bcf4279-b6db-48a4-bd73-d3050715da5a"
  }'
```

#### Response:
```json
{
  "valid": true,
  "anchorStatus": "active",
  "issuedAt": "2026-08-09T12:00:00.000Z"
}
```

Verification resolves the public key from ScatterID's internal key registry (using the stored `publicKeyId`), checks the ML-DSA-65 signature, and confirms the ledger anchor status. It never trusts any `publicKey` or `publicKeyId` supplied in the request body.

---

### C. Checking Credential Status (`GET /status/:id`)

```bash
curl http://localhost:3000/status/4bcf4279-b6db-48a4-bd73-d3050715da5a
```

#### Response:
```json
{
  "id": "4bcf4279-b6db-48a4-bd73-d3050715da5a",
  "dataHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "algorithm": "ML-DSA-65",
  "anchorTxId": "0df0fa3b...",
  "status": "anchored",
  "issuedAt": "2026-08-09T12:00:00.000Z"
}
```

---

### D. Triggering Key Rotation (`POST /rotate`)

```bash
curl -X POST https://localhost:5001/rotate \
  --insecure \
  -H "Authorization: Bearer $CRYPTO_SERVICE_API_KEY"
```

---

## 7. Operator Dashboard

The project dashboard (`http://localhost:4000`) provides:

- **System Status**: Real-time health of Crypto Service, Verification API, and Fabric peers.
- **Credentials Explorer**: Browse and inspect all issued credentials.
- **E2E Diagnostics**: Run a smoke test that issues a credential and verifies it end-to-end.
- **Container Logs**: Stream Docker container logs for any running service.
- **Settings**: View tenant configuration and trigger API key rotation.
