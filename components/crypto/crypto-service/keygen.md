# Component Technical Specification: keygen.py

## 1. Purpose & Core Responsibility
- Generates post-quantum cryptographic (PQC) signing keypairs using the `liboqs` library.
- Supports standardized ML-DSA algorithms.

## 2. Inbound & Outbound Communication Whitelist
- **Allowed Inbound (Who can talk TO this file):** 
  - `interface.py` via Python imports.
  - `kms.py` via Python imports.
- **Explicitly Denied Inbound:** 
  - All direct external requests or other system files.
- **Allowed Outbound (Who this file can talk TO):** 
  - `oqs` third-party library API methods.
- **Explicitly Denied Outbound:** 
  - N/A.

## 3. Function & Method Manifest
- **`generate_keypair(algorithm)`**
  - **Purpose:** Generates raw public/secret keypair bytes.
  - **Inputs & Sanitization:** 
    - `algorithm`: Validated against whitelisted standards `["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"]`.
  - **Outputs:** Tuple of `(public_key_bytes, private_key_bytes)`.
  - **Error States & Handling:** Raises `ValueError` if the algorithm parameter is unsupported.

## 4. Security & Compliance Posture
- Restricts signature standard configurations to verified FIPS-compliant algorithms.
- Prevents loading arbitrary algorithms to defend against cryptographic degradation attacks.
