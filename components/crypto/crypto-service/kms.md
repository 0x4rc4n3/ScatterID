# Component Technical Specification: kms.py

## 1. Purpose & Core Responsibility
- Acts as the Key Management Service (KMS) interface for ScatterID's cryptoservice. It securely reads, writes, and rotates post-quantum signing keys directly inside HashiCorp Vault.
- Implements secure local in-memory fallback options and secure local history tracking if Vault is temporarily unreachable.

## 2. Inbound & Outbound Communication Whitelist
- **Allowed Inbound (Who can talk TO this file):** 
  - `app.py` (Flask microservice logic) via internal Python imports.
- **Explicitly Denied Inbound:** 
  - All other external direct execution.
- **Allowed Outbound (Who this file can talk TO):** 
  - HashiCorp Vault API (`vault.scatterid.com`) via `hvac` Python package on port 8200 (over HTTP/HTTPS).
  - Local Disk filesystem (read/write access to `/app/data/key_history.json` and `/app/certs/key_history.json`).
- **Explicitly Denied Outbound:** 
  - All other outbound connections.

## 3. Function & Method Manifest
- **`__init__()`**
  - **Purpose:** Initializes environmental configurations (Vault url, tokens, AppRole credentials) and triggers initial Vault authentication.
  - **Inputs & Sanitization:** N/A (Constructs configuration dynamically from global configuration loader).
  - **Outputs:** KMS class instance.
  - **Error States & Handling:** Catches connection timeouts and falls back gracefully to local variables.

- **`_load_disk_history()`**
  - **Purpose:** Loads previous public key bytes from disk to support verification of older credentials.
  - **Inputs & Sanitization:** Reads local JSON file. Validates that parsed hex strings match the expected public key byte lengths.
  - **Outputs:** In-memory key history update.
  - **Error States & Handling:** Any read/JSON parse errors are logged as warnings and caught.

- **`_save_disk_history()`**
  - **Purpose:** Securely persists the public key history array to disk.
  - **Inputs & Sanitization:** Serializes key bytes array to hexadecimal format.
  - **Outputs:** File write.
  - **Error States & Handling:** Securely writes data with owner-only file modes (`0o600`). Catches write/permission exceptions.

- **`_init_vault()`**
  - **Purpose:** Connects and logs in to Vault. Attempts AppRole authentication if credentials exist, defaulting to token fallback.
  - **Inputs & Sanitization:** Vault URL and credentials.
  - **Outputs:** Authenticated Vault connection client.
  - **Error States & Handling:** Catches networking exceptions or authentication failures and switches to in-memory key fallbacks.

- **`_sync_vault_history()`**
  - **Purpose:** Scans through all past KV version numbers on Vault to populate the public key history.
  - **Inputs & Sanitization:** Vault metadata list.
  - **Outputs:** Array additions.
  - **Error States & Handling:** Ignores single version read failures to avoid halting operations.

- **`get_keys(algorithm)`**
  - **Purpose:** Retrieves the current active ML-DSA keypair from Vault. Generates a new keypair if none is active.
  - **Inputs & Sanitization:** `algorithm` parameter. Must be one of `["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"]`.
  - **Outputs:** Tuple containing `(public_key_bytes, private_key_bytes)`.
  - **Error States & Handling:** If Vault connection is missing, uses secure in-memory generation. Catches path errors or network faults.

- **`rotate_keys(algorithm)`**
  - **Purpose:** Generates a new ML-DSA keypair and updates the active secret on Vault.
  - **Inputs & Sanitization:** `algorithm` parameter. Must be one of `["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"]`.
  - **Outputs:** Tuple containing the new `(public_key_bytes, private_key_bytes)`.
  - **Error States & Handling:** Vault write failures fall back to in-memory active key rotations.

## 4. Security & Compliance Posture
- Restricts local file tracking to owner-only permissions (`0o600`).
- Implements Zero Trust least privilege AppRole authentication boundaries.
- Employs dynamic fallback mechanisms ensuring high availability without compromising security.
