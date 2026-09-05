# Deployment & Orchestration Scripts

Automation scripts for provisioning, verifying dependencies, and managing the local multi-service container cluster for **ScatterID**.

---

## 1. Script Catalog

| Script | Purpose | Execution |
| :--- | :--- | :--- |
| [`quickstart.sh`](file:///home/kali/scatterid-ecosystem/ScatterID/scripts/quickstart.sh) | Complete cold-start cluster bootstrap: verifies dependencies, provisions HashiCorp Vault secrets, sets up the Hyperledger Fabric channel, and builds/starts microservices. | `./scripts/quickstart.sh` |
| [`start.sh`](file:///home/kali/scatterid-ecosystem/ScatterID/scripts/start.sh) | Lightweight service runner: starts existing containers, attaches external Docker bridge network (`scatterid_net`), and checks endpoint health. | `./scripts/start.sh` |
| [`check_deps.sh`](file:///home/kali/scatterid-ecosystem/ScatterID/scripts/check_deps.sh) | System prerequisite verification: inspects host environment for Docker Engine 24+, Compose v2, Node.js 20+, Go 1.22+, Python 3.10+, OpenSSL 3.x, and liboqs. | `./scripts/check_deps.sh` |
| [`test_all.sh`](file:///home/kali/scatterid-ecosystem/ScatterID/scripts/test_all.sh) | End-to-end integration and smoke test runner: performs issuance, ledger commit verification, off-chain proof verification, and revocation checks against a running stack. | `./scripts/test_all.sh` |

---

## 2. Configuration & Security Defaults

The orchestration layer enforces defense-in-depth security defaults across container definitions:

### Administrative Privilege Separation
- **`VERIFICATION_API_KEY`**: Authenticates standard verifier and issuer gateway traffic (`/credentials/issue`, `/credentials/:id/verify`).
- **`REVOKE_API_KEY`**: Dedicated administrative key required exclusively for `/credentials/:id/revoke`. The verification service explicitly verifies at initialization that `REVOKE_API_KEY` is set and does not match `VERIFICATION_API_KEY`.

### Vault Transport Security
- **`VAULT_DEV_MODE`**: Set to `false` by default. When `false`, the crypto service refuses plain HTTP communication with Vault, requiring valid TLS transport. In local air-gapped dev environments, developers must explicitly supply `VAULT_DEV_MODE=true` to enable plaintext loopback connections.
- **`CRYPTO_SERVICE_API_KEY`**: Protects the internal Python cryptographic engine (`:5001`), which runs behind mutual TLS (mTLS) with pinned CA validation (`/app/certs/ca.crt`).

---

## 3. Usage Examples

### Cold Start Bootstrap
```bash
# 1. Verify host tooling
./scripts/check_deps.sh

# 2. Bootstrap full cluster
./scripts/quickstart.sh

# 3. Verify end-to-end functionality
./scripts/test_all.sh
```

### Stopping Services
```bash
docker compose down
```
