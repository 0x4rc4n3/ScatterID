# Component Technical Specification: interface.py (KMS Crypto-Service Copy)

## 1. Purpose & Core Responsibility
- Acts as the primary interface layer for the PQC and Shamir Secret Sharing sharding module within the KMS Crypto-Service.
- Coordinates credential signing (via post-quantum ML-DSA) and secret sharding (via Shamir Secret Sharing) during credential packaging and verification.

## 2. Inbound & Outbound Communication Whitelist
- **Allowed Inbound (Who can talk TO this file):** 
  - `app.py` (Flask microservice endpoints `/package` and `/unpackage`) via Python imports.
- **Explicitly Denied Inbound:** 
  - All other external integrations.
- **Allowed Outbound (Who this file can talk TO):** 
  - `keygen.py`, `pq_sign.py`, and `shamir.py` local module dependencies.
- **Explicitly Denied Outbound:** 
  - All external network connections.

## 3. Function & Method Manifest
- **`package_credential(data, private_key, public_key, n, k, algorithm)`**
  - **Purpose:** Hashes, signs, and splits raw claim data dictionary into $n$ SSS shards.
  - **Inputs & Sanitization:** 
    - `data`: Dict (validated as dictionary type).
    - `private_key`: Bytes (validated as non-empty).
    - `public_key`: Optional bytes.
    - `n`, `k`: Validated to be integers, positive, and threshold $k \le n$.
    - `algorithm`: Validated against whitelisted signature standards `["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"]`.
  - **Outputs:** JSON-safe SignedCredential dict containing SHA3-256 hash, signature hex, split SSS shards, algorithm, created timestamp, and optional public key.
  - **Error States & Handling:** Type or range check failures raise `TypeError` or `ValueError` exceptions immediately, blocking operations.

- **`unpackage_credential(signed_credential, public_key, shares_subset)`**
  - **Purpose:** Recovers and verifies original credential claims from a subset of SSS shards.
  - **Inputs & Sanitization:** 
    - `signed_credential`: Dict (validated as dictionary, checking presence of `shares`, `signature`, `algorithm` keys).
    - `public_key`: Bytes or List of Bytes (validated as bytes or list of bytes).
    - `shares_subset`: List (validated as list type).
  - **Outputs:** Tuple `(recovered_data_bytes, is_valid_boolean)`.
  - **Error States & Handling:** Raises `ValueError` or `TypeError` if input components fail checks or subset count falls below threshold requirements.

## 4. Security & Compliance Posture
- Enforces strict input validation and cryptographic algorithm whitelisting at the interface boundary.
- Prevents cascade failures by returning clear, typed validation exceptions to the calling controller.
