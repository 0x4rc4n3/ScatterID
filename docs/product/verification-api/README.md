# Express Verification Gateway & Shamir Dispatcher

The `verification-api` service acts as the central orchestrator for credential claim issuance, Shamir Secret Sharing distribution, post-quantum signature verification, and Hyperledger Fabric ledger anchoring.

---

## 🔒 Security Architecture

1. **Strict Container Network Fetching**:
   - `getSharesByCredentialId` queries isolated shard node HTTP endpoints (`http://shard-node-1:3000` .. `http://shard-node-5:3000`) over the `scatterid_net` bridge network.
   - Local SQLite disk bypassing is strictly disabled to guarantee true network fault tolerance boundaries.

2. **Bearer Token Authentication**:
   - Outgoing HTTP calls to shard nodes contain `Authorization: Bearer <SHARD_NODE_API_KEY>`.
   - Outgoing HTTPS calls to `crypto-service` contain `Authorization: Bearer <CRYPTO_SERVICE_API_KEY>`.

---

## 📡 API Reference

### 1. Issue Credential Payload
- **Endpoint**: `POST /issue`
- **Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "claim": {
      "subject": "did:scatterid:user-123",
      "role": "Security Officer"
    }
  }
  ```
- **Response**:
  ```json
  {
    "status": "anchored",
    "credentialId": "a4e5a547-49e3-4736-86df-97a2da1ffe22",
    "dataHash": "dd55cadfcc7d690e9ac7b2348bdf01dbc4516fa6aed218d73b74ef2226d0d4da",
    "algorithm": "ML-DSA-65",
    "anchorTxId": "b2589afd49c3ab67ebf08598c9baac7c229e75c15048f68d9050d06a1d0eeb60",
    "dispatchReport": [
      { "nodeId": 1, "shareIndex": 1, "containerUrl": "http://shard-node-1:3000", "httpStatus": "WRITTEN" },
      { "nodeId": 2, "shareIndex": 2, "containerUrl": "http://shard-node-2:3000", "httpStatus": "WRITTEN" },
      { "nodeId": 3, "shareIndex": 3, "containerUrl": "http://shard-node-3:3000", "httpStatus": "WRITTEN" },
      { "nodeId": 4, "shareIndex": 4, "containerUrl": "http://shard-node-4:3000", "httpStatus": "WRITTEN" },
      { "nodeId": 5, "shareIndex": 5, "containerUrl": "http://shard-node-5:3000", "httpStatus": "WRITTEN" }
    ],
    "shares": { "required": 3, "total": 5 }
  }
  ```

### 2. Verify Credential
- **Endpoint**: `POST /verify`
- **Request Body**:
  ```json
  {
    "credentialId": "a4e5a547-49e3-4736-86df-97a2da1ffe22"
  }
  ```
- **Response**:
  ```json
  {
    "valid": true,
    "anchorStatus": "active",
    "issuedAt": "2026-08-09T13:48:31.960544+00:00"
  }
  ```

### 3. Retrieve All Credentials
- **Endpoint**: `GET /credentials`
- **Description**: Queries all stored credential records and returns their status and sharding metadata.
- **Response**:
  ```json
  {
    "success": true,
    "credentials": [
      {
        "id": "a4e5a547-49e3-4736-86df-97a2da1ffe22",
        "data_hash": "dd55cadfcc7d690e9ac7b2348bdf01dbc4516fa6aed218d73b74ef2226d0d4da",
        "algorithm": "ML-DSA-65",
        "signature": "...",
        "public_key": "...",
        "prime_mod": "...",
        "required_shares": 3,
        "anchor_tx_id": "...",
        "status": "anchored",
        "issued_at": "..."
      }
    ]
  }
  ```

### 4. Auto-Heal Node Shards
- **Endpoint**: `POST /heal-shards`
- **Request Body**: `{"nodeId": 4}`
- **Response**:
  ```json
  {
    "success": true,
    "events": [
      { "nodeId": 4, "healedShares": 1, "logText": "[AUTO-HEAL] Shard Node 4 auto-synced 1 missing secret shares." }
    ]
  }
  ```
