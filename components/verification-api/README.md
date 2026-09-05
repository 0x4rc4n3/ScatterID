# Verification Gateway API (`verification-api`)

The primary integration gateway for **ScatterID**, orchestrating credential issuance, on-chain state queries, offline proof verification, and administrative revocation across the post-quantum crypto service and Hyperledger Fabric ledger.

---

## 1. Architecture & Dual-Key Security Model

The Verification Gateway operates on port `:3000` (Node.js / Express) and acts as the trusted orchestrator between public verifiers, the isolated post-quantum crypto service, and the consortium blockchain:

```
                                  +---------------------------------------+
                                  |            Verifier / Client          |
                                  +-------------------+-------------------+
                                                      |
                                                      | Bearer VERIFICATION_API_KEY
                                                      v
                                  +---------------------------------------+
                                  |       Verification Gateway API        |
                                  |         (Node.js / Express)           |
                                  +---------+-------------------+---------+
                                            |                   |
                       mTLS + Crypto API Key|                   | gRPC / mTLS
                                            v                   v
                               +--------------------+   +--------------------+
                               |   Crypto Service   |   | Fabric Peer (Org1) |
                               | (Flask / ML-DSA-65)|   |  (scatterproof CC) |
                               +--------------------+   +--------------------+
```

### Administrative Privilege Separation
To enforce least privilege, the gateway strictly isolates standard verification and issuance operations from administrative revocations:

- **`VERIFICATION_API_KEY`**: Authenticates standard client operations (`/credentials/issue`, `/credentials/verify`, `/credentials/:id`, `/credentials/:id/history`).
- **`REVOKE_API_KEY`**: Dedicated administrative credential required exclusively for `/credentials/:id/revoke`.
- **Fail-Fast Startup Guard**: At service initialization, `server.js` validates that both keys are configured and strictly distinct:
  ```javascript
  if (!process.env.REVOKE_API_KEY || process.env.REVOKE_API_KEY === process.env.VERIFICATION_API_KEY) {
      console.error('[FATAL] REVOKE_API_KEY must be set and distinct from VERIFICATION_API_KEY');
      process.exit(1);
  }
  ```

---

## 2. API Reference

All requests require HTTP Header: `Authorization: Bearer <API_KEY>`.

### Credential Issuance
- **`POST /credentials/issue`**
  - **Auth**: `VERIFICATION_API_KEY`
  - **Payload**:
    ```json
    {
      "holderId": "holder-public-key-or-uuid",
      "claims": { "name": "Alice", "country": "US" }
    }
    ```
  - **Operation**: Computes RFC 8785 canonical claim commitments, requests ML-DSA-65 signature from `crypto-service` (`:5001`), records issuance in local SQLite database, and anchors the proof commitment hash to the Fabric blockchain ledger.

### Credential Verification
- **`POST /credentials/verify`**
  - **Auth**: `VERIFICATION_API_KEY`
  - **Payload**:
    ```json
    {
      "credential": { ... }
    }
    ```
  - **Operation**: Validates structural schema, recomputes claim hashes, verifies the ML-DSA-65 signature against issuer public key, and queries Fabric chaincode to confirm the proof state is `ACTIVE`.

### Metadata & History
- **`GET /credentials/:credentialId`**: Returns metadata and current status for a given credential ID.
- **`GET /credentials/:credentialId/history`**: Returns the immutable chronological state history (`txId`, `timestamp`, `status`) directly from Fabric ledger's key history iterator. Raw claims never appear in ledger history.

### Administrative Revocation
- **`POST /credentials/:credentialId/revoke`**
  - **Auth**: `REVOKE_API_KEY` (Rejects `VERIFICATION_API_KEY` with HTTP 401/403)
  - **Operation**: Submits a `RevokeProof` transaction to the Fabric ledger under the issuing identity and marks the local credential record as revoked.

### Health Check
- **`GET /health`**: Returns status of the gateway, upstream crypto microservice connectivity, and Fabric network channel readiness.

---

## 3. Input Normalization & Resilience

- **Case Normalization**: All UUIDs and cryptographic hex hashes (SHA3-256) are normalized via lowercase trimming (`value.toLowerCase().trim()`) before database queries and blockchain transactions, preventing key fragmentation across systems.
- **Path Resolution**: Relative certificate and network profile paths are resolved against the absolute workspace root, ensuring seamless execution in both containerized and bare-metal environments.

---

## 4. Configuration & Environment Variables

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `3000` | Gateway HTTP listen port |
| `VERIFICATION_API_KEY` | *(Required)* | Inbound bearer token for issuance and verification routes |
| `REVOKE_API_KEY` | *(Required)* | Inbound bearer token for administrative revocation |
| `CRYPTO_SERVICE_URL` | `https://crypto-service:5001` | Base URL of internal crypto service |
| `CRYPTO_SERVICE_API_KEY` | *(Required)* | Upstream client API key for crypto service |
| `SQLITE_DB_PATH` | `/app/data/credentials.db` | Path to local SQLite metadata database |
| `NODE_EXTRA_CA_CERTS` | `/app/certs/ca.crt` | Path to crypto service mTLS CA certificate |

---

## 5. Automated Unit & Integration Tests

```bash
# Run Mocha/Chai test suite
npm test
```

### Coverage (30/30 tests passing)
- Startup fail-fast configuration guards (`REVOKE_API_KEY !== VERIFICATION_API_KEY`)
- Route authentication enforcement and forbidden key access
- Case normalization across issuance, verification, and revocation parameters
- Post-quantum signature verification workflows
- Audit history route authentication and response framing
