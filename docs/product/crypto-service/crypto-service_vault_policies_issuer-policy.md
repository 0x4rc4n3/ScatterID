# Component Technical Specification: issuer-policy.hcl

## 1. Purpose & Core Responsibility
- Enforces strict Least Privilege access boundaries inside HashiCorp Vault Secrets Manager for the KMS client to read and rotate post-quantum signing keypairs.

## 2. Inbound & Outbound Communication Whitelist
- **Allowed Inbound (Who can talk TO this file):** 
  - HashiCorp Vault Policy Engine via Vault admin policy write operations.
- **Explicitly Denied Inbound:** 
  - All other services and users.
- **Allowed Outbound (Who this file can talk TO):** 
  - N/A (Static HCL policy specification file).
- **Explicitly Denied Outbound:** 
  - N/A.

## 3. Function & Method Manifest
- **`path "secret/data/scatterid/mldsa"`**
  - **Purpose:** Grants access to write and read the actual cryptographic secret values.
  - **Inputs & Sanitization:** Limited strictly to `create`, `read`, and `update` capabilities.
  - **Outputs:** JSON secret payloads containing public and private keys.
  - **Error States & Handling:** Invalid paths or unauthorized capabilities return HTTP 403 Forbidden.

- **`path "secret/metadata/scatterid/mldsa"`**
  - **Purpose:** Grants metadata lookup capabilities to retrieve secret version history.
  - **Inputs & Sanitization:** Limited strictly to `read` capability.
  - **Outputs:** Secret engine version history map.
  - **Error States & Handling:** Unauthorized capabilities return HTTP 403 Forbidden.

## 4. Security & Compliance Posture
- Implements Zero Trust least privilege boundary.
- Denies delete/destroy privileges to prevent data loss or service disruption attacks on primary keys.
