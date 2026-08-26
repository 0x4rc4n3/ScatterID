# Crypto Microservice (`crypto-service`)

The `crypto-service` component is an isolated Python Flask microservice responsible for post-quantum digital signatures, Zero-Knowledge Verification, and Key Management Service (KMS) integration with HashiCorp Vault.

---

## 1. System Role & Security Boundaries

`crypto-service` functions as the post-quantum cryptographic authority for the ScatterID architecture. It operates statelessly and enforces strict security boundaries:

- **Key Isolation**: Private keys are never stored on local disk or environment variables. All signing keypairs (ML-DSA-65) are fetched at runtime or rotated dynamically via HashiCorp Vault over mTLS REST endpoints (`secret/data/crypto`).
- **Transport Security**: Listens exclusively over HTTPS (TLS 1.2/1.3) on port 5001. Requires a valid `Authorization: Bearer <API_KEY>` header for all incoming endpoints via `@app.before_request` middleware.
- **Algorithm Standard**: Uses `liboqs` (Open Quantum Safe C library) providing NIST FIPS 204 compliant **ML-DSA-65** digital signatures.

---

## 2. API Specification & Error Handling

### `POST /package`
Generates a SHA3-256 digest of the input claim, signs the digest using the active ML-DSA-65 private key, splits the payload into $k$-of-$n$ ($3$-of-$5$) Zero-Knowledge Verification secret shares, and computes per-share SHA-256 integrity checksums.

#### Request Header & Body
```http
POST /package HTTP/1.1
Host: crypto-service:5001
Authorization: Bearer <CRYPTO_SERVICE_API_KEY>
Content-Type: application/json

{
  "claim": {
    "subject": "did:scatterid:user-001",
    "degree": "BSc Computer Science"
  }
}
```

#### Response Body (`201 Created`)
```json
{
  "algorithm": "ML-DSA-65",
  "created_at": "2026-08-09T09:35:13.150798+00:00",
  "data_hash": "be6b1db444cd6e2613386e2f9346fb50a83dbd7fe415045b1a2608fedbfa4525",
  "signature": "<hex_encoded_ml_dsa_65_signature>",
  "shares": {
    "prime_mod": "07ffffffffffffffffffffffffff",
    "required_shares": 3,
    "shares": [
      "1-<share_value>:<sha256_checksum>",
      "2-<share_value>:<sha256_checksum>",
      "3-<share_value>:<sha256_checksum>",
      "4-<share_value>:<sha256_checksum>",
      "5-<share_value>:<sha256_checksum>"
    ]
  }
}
```

---

### `POST /unpackage`
Reconstructs the original raw secret from $\ge 3$ Zero-Knowledge Verification shares, validates per-share SHA-256 checksums, and verifies the ML-DSA-65 signature against the active public key.

#### Request Body
```json
{
  "credential": {
    "data_hash": "be6b1db444cd6e2613386e2f9346fb50a83dbd7fe415045b1a2608fedbfa4525",
    "signature": "<hex_encoded_ml_dsa_65_signature>",
    "algorithm": "ML-DSA-65",
    "shares": {
      "prime_mod": "07ffffffffffffffffffffffffff",
      "required_shares": 3,
      "shares": ["1-...", "2-...", "3-..."]
    }
  },
  "sharesSubset": ["1-...", "2-...", "3-..."]
}
```

#### Response Body (`200 OK`)
```json
{
  "valid": true,
  "recoveredData": "{\"subject\":\"did:scatterid:user-001\",\"degree\":\"BSc Computer Science\"}"
}
```

---

### Error Handling & Standard Codes

| Code | HTTP Status | Description |
|---|---|---|
| `UNAUTHORIZED` | `401 Unauthorized` | Missing or invalid `Bearer <API_KEY>` authorization header. |
| `BAD_REQUEST` | `400 Bad Request` | Missing required fields (`claim`, `credential`, `sharesSubset`). |
| `RECONSTRUCTION_FAILED` | `400 Bad Request` | Less than $k$ valid shares provided or Zero-Knowledge Verification reconstruction failure. |
| `ROTATION_FAILED` | `500 Internal Server Error` | Vault KMS connection failure during key rotation. |

---

## 3. Environment Variables

| Variable | Type | Default | Description |
|---|---|---|---|
| `CRYPTO_SERVICE_API_KEY` | String | *Required* | API key expected in `Authorization: Bearer <KEY>` header. |
| `VAULT_ADDR` | String | `http://vault:8200` | Address of the HashiCorp Vault server. |
| `VAULT_TOKEN` | String | `dev-root-token` | Vault access token with read/write policy for `secret/data/crypto`. |

---

## 4. Execution & Testing

### Direct Local Execution
```bash
# Ensure TLS certificates exist
bash ../certs/generate_certs.sh

export CRYPTO_SERVICE_API_KEY="dev-secret-key-123"
export VAULT_ADDR="http://localhost:8200"
export VAULT_TOKEN="dev-root-token"

python3 app.py
```

### Automated Integration Test
```bash
curl -k -X POST \
  -H "Authorization: Bearer dev-secret-key-123" \
  -H "Content-Type: application/json" \
  -d '{"claim":{"subject":"did:test"}}' \
  https://localhost:5001/package
```
