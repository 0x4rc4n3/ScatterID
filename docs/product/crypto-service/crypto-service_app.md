# Component Technical Specification: app.py (KMS Crypto-Service)

## 1. Purpose & Core Responsibility
- Acts as the HTTPS Flask microservice gateway for post-quantum cryptographic (PQC) functions and sharding actions.
- Exposes API endpoints for credential packaging, unpackaging, and key rotation.

## 2. Inbound & Outbound Communication Whitelist
- **Allowed Inbound (Who can talk TO this file):** 
  - Verification API Gateway (`verification-api`) via HTTPS on Port 5001, authorized using Bearer tokens (`CRYPTO_SERVICE_API_KEY`).
- **Explicitly Denied Inbound:** 
  - All other external integrations and unauthenticated network callers.
- **Allowed Outbound (Who this file can talk TO):** 
  - HashiCorp Vault Secrets Manager via the `kms.py` client API (read/write KV endpoints).
  - OpenSSL subprocess commands during TLS generation.
- **Explicitly Denied Outbound:** 
  - Direct database or untrusted network interfaces.

## 3. Function & Method Manifest
- **`enforce_api_key()`**
  - **Purpose:** Restricts request execution only to callers presenting valid Bearer headers.
  - **Inputs & Sanitization:** Authorization header. Validated to be string starts with `Bearer `.
  - **Outputs:** None on success, aborts request on failure.
  - **Error States & Handling:** Returns HTTP 401 Unauthorized.

- **`POST /package`**
  - **Purpose:** Packs a claim dictionary using ML-DSA signatures and Shamir Secret Sharing.
  - **Inputs & Sanitization:** 
    - `claim`: Must be dictionary.
    - `claim.subject`: Non-empty string. Stripped of injection characters `<>'\"&;` and limited to 256 characters.
    - `claim.role` (optional): String. Stripped of injection characters `<>'\"&;` and limited to 256 characters.
  - **Outputs:** JSON SignedCredential payload.
  - **Error States & Handling:** Parameter anomalies yield HTTP 400.

- **`POST /unpackage`**
  - **Purpose:** Reconstructs and verifies claims from SSS shards.
  - **Inputs & Sanitization:** 
    - `credential`: Object.
    - `sharesSubset`: Array. Checked via regular expression `re.compile(r'^[1-5]-[0-9a-f]+(:[0-9a-f]+)?$', re.IGNORECASE)`.
    - `credential.id` (optional): Validated as UUID v4 string.
  - **Outputs:** JSON recovered claims and signature verification status.
  - **Error States & Handling:** Internal execution stack traces are masked and return generic `Credential reconstruction failed` (HTTP 400).

- **`POST /rotate`**
  - **Purpose:** Triggers KMS key pair rotation inside Vault.
  - **Inputs & Sanitization:** N/A.
  - **Outputs:** Successful rotation message.
  - **Error States & Handling:** KMS errors are masked and return generic `Key rotation operation failed` (HTTP 500).

## 4. Security & Compliance Posture
- Enforces strict inter-service authentication (Default Deny).
- Restricts input formats through robust regular expression and character-stripping sanitizers.
- Prevents database, filesystem, or application infrastructure data disclosures by masking error outputs.
