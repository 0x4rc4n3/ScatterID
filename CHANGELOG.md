# Changelog

All notable changes to ScatterID are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [0.4.0] — 2026-08-30 · Backend Correctness, Reconciliation & SDK Lifecycle

### Fixed
- **[ROOT CAUSE] Issuance Silent Failure:** `POST /issue` returns HTTP 202 Accepted with `status: 'anchor_failed'` when ledger anchoring throws, avoiding false positive `'pending'` reporting. Added `POST /issue/:credentialId/retry-anchor` endpoint for deterministic anchor retry.
- **[ROOT CAUSE] Revocation Silent Failure:** `POST /revoke` now strictly updates local DB status to `'revoked'` only after Hyperledger Fabric `RevokeProof` transaction successfully commits. If ledger throws, returns HTTP 502 (`LEDGER_UNREACHABLE`) and leaves local record untouched.
- **SDK Build & Docker Resolution:** Added TypeScript `tsc` build step to `sdk/`, integrated multi-stage Docker build for `project-dashboard`, and automated SDK builds in GitHub Actions CI.
- **Unified Cryptographic Hashing:** Replaced naive duplicate SHA-256 in `project-dashboard` with official `@scatterid/sdk` client using RFC 8785 canonicalization + 16-byte CSPRNG salt + SHA3-256.

### Added
- **Ledger Reconciliation Daemon:** Periodic background reconciliation engine comparing local SQLite credentials against Hyperledger Fabric `QueryProof` states, detecting and alerting on state divergence.
- **Durable Audit Trail:** Added `audit_log` table tracking cryptographic actions, caller authorization tiers (`bearer_api_key`, `revoke_api_key`), and outcomes.
- **Tiered Revocation Authorization:** Gated `/revoke` behind a dedicated, scoped `REVOKE_API_KEY`.
- **Cross-Language Verifier Parity:** Added automated test suite validating 100% mathematical output parity between Node.js (`verify_offline.js`) and Python (`verify_offline.py`).

### Removed
- Removed empty `fabric-samples` directory and packaged self-contained Fabric binaries and configurations.
- Removed obsolete `todoo.md` and redundant `demo.html` surfaces.

---

## [0.3.5] — 2026-08-26 · Security Remediation Pass

### Added
- GitHub Actions CI/CD pipeline with SDK, verification-api, crypto-service, Docker build, and dependency audit jobs
- `helmet` security headers middleware on verification-api and project-dashboard
- `express-rate-limit` (30 req/min per IP) on all issuance/verification/API endpoints
- Dashboard API authentication via `Authorization: Bearer <GATEWAY_API_KEY>` with `timingSafeEqual` comparison
- UNIQUE database index on `credentials.data_hash` for O(log n) lookups in `/verify`
- `toApiShape()` mapper in `db/models.js` for consistent snake_case → camelCase normalization
- `getCredentialByDataHash()` indexed lookup replacing full-table scan
- Comprehensive test suite for `pq_sign.py`: round-trip, tampered signature, wrong key, wrong algorithm, empty inputs
- KMS `zeroize()` tests
- Extended verification-api tests: tampered hash rejection, crypto-service unreachable (issue + verify), `toApiShape` mapper output shape
- `LICENSE` (MIT), `SECURITY.md`, `CONTRIBUTING.md`
- `config.example.json` template for safe local configuration setup
- `CHANGELOG.md` (this file)
- "Current Limitations" section in README for honest project status disclosure

### Fixed
- **[CRITICAL]** Removed `process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'` global TLS bypass from verification-api — TLS now validated against the ScatterID internal CA via `NODE_EXTRA_CA_CERTS`
- **[CRITICAL]** Removed `/var/run/docker.sock` bind mount from dashboard container (was a full host-compromise path via any code in the container)
- **[CRITICAL]** Removed all weak default secret fallbacks (`:-dev-secret-key-123`, `:-scatterid-vault-root-token`, `:-scatterid-test-api-key-999`) from `docker-compose.yml`
- **[CRITICAL]** Untracked `config.json` and `components/project-dashboard/config.json` from git (was tracked despite `.gitignore` rule — live secret-leak footgun)
- **[CRITICAL]** Fixed Vault URL validation in `kms.py` to use explicit `VAULT_DEV_MODE=true` flag instead of substring-matching the URL hostname (old check would pass `http://vault.attacker.com`)
- Certificate generation errors in `app.py` now log and fail fast rather than being silently swallowed with bare `except: pass`
- Replaced O(n) `getAllCredentials().find()` linear scan in `/verify` with indexed `getCredentialByDataHash()` lookup
- Removed `exec()` shell command execution from dashboard — `runCmd()` and Docker socket dependency eliminated entirely

### Changed
- Dashboard fails fast at startup if `GATEWAY_API_KEY` is unset or `'disabled'`
- All database query functions now return normalized camelCase objects via `toApiShape()` — eliminates scattered `record.field || record.field_name` dual-key fallbacks
- `docker-compose.yml`: `NODE_TLS_REJECT_UNAUTHORIZED: "0"` replaced with explanatory comment about CA trust chain

---

## [0.3.0] — 2026-08-25 · Core Crypto Security Hardening

### Fixed
- Enforced secure HTTPS connections in KMS client
- Prevented fallback key generation that could silently produce insecure keys
- Added `threading.RLock` state locking to crypto-service for thread safety
- Implemented memory zeroization for private keys after use

---

## [0.2.0] — 2026-08-24 · Zero-Knowledge Architecture Refactor (v1 → v2)

### Changed
- Complete architectural refactor to Zero-Knowledge hashing model
- ScatterID now **never stores raw claim data** — only `dataHash`, signature, `publicKeyId`, and ledger anchor info
- Verification uses hash-commitment: client SDK computes `SHA3-256(salt || canonicalizedClaim)` locally

### Added
- ML-DSA-65 (NIST FIPS 204 CRYSTALS-Dilithium3) post-quantum signatures via `liboqs-python`
- HashiCorp Vault KMS integration with AppRole authentication support
- Hyperledger Fabric blockchain anchoring (`AnchorProof` / `QueryProof` chaincode)
- TypeScript/JavaScript SDK with RFC 8785 (JCS) canonicalization
- Idempotency key support on `/issue` endpoint for safe retry semantics
- `generate_certs.sh` for reproducible CA and server certificate generation

---

## [0.1.0] — 2026-08-22 · Initial MVP Scaffold

### Added
- Initial component-based architecture: `crypto-service`, `verification-api`, `project-dashboard`
- Docker Compose multi-container topology with internal `scatterid_net` network
- Hyperledger Fabric network configuration (orderer, peers, chaincode)
- Basic E2E smoke test script (`test_all.sh`)
- Operator Dashboard with port-based health checks
