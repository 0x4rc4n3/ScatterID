# Component Technical Specification: shamir.py

## 1. Purpose & Core Responsibility
- Serves as the core Shamir Secret Sharing sharding mathematical wrapper.
- Splits binary raw payloads (secrets) into multiple hexadecimal-encoded fragments (shards) and reconstructs them using threshold algebra over prime fields.

## 2. Inbound & Outbound Communication Whitelist
- **Allowed Inbound (Who can talk TO this file):** 
  - `interface.py` via Python package imports.
- **Explicitly Denied Inbound:** 
  - All other scripts and direct external connections.
- **Allowed Outbound (Who this file can talk TO):** 
  - `sslib.shamir` library APIs.
- **Explicitly Denied Outbound:** 
  - N/A.

## 3. Function & Method Manifest
- **`split_secret(secret, n, k)`**
  - **Purpose:** Splits secret bytes into $n$ parts, requiring a threshold of $k$ to recover.
  - **Inputs & Sanitization:** 
    - `secret`: Must be non-empty `bytes`.
    - `n`, `k`: Must be positive integers, validating that threshold $k \le n$.
  - **Outputs:** Dict containing the SSS configurations and hex-encoded shares.
  - **Error States & Handling:** Raises `ValueError` or `TypeError` for parameter bounds failures.

- **`reconstruct_secret(shares_data)`**
  - **Purpose:** Interpolates Lagrange polynomials over the prime field to recover raw secret bytes from a subset of shares.
  - **Inputs & Sanitization:** 
    - `shares_data`: Dict. Validates presence of keys `shares` (list of strings), `required_shares` (integer), and `prime_mod` (string).
    - Checks that the list size is at least `required_shares`.
  - **Outputs:** Raw `bytes` of the recovered secret.
  - **Error States & Handling:** Raises `ValueError` or `TypeError` if inputs are malformed or count falls below threshold.

## 4. Security & Compliance Posture
- Mathematical sharding limits data disclosure. No single storage node holds sufficient entropy to rebuild the secret.
- Enforces strict parameter boundaries to prevent algebra errors or integer overflow bugs in underlying prime-modulo libraries.
