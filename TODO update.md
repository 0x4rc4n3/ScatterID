# ScatterID Engineering TODO & Architecture Blueprint

> Reconciled against actual code, tests, and Dockerfiles as of this
> remediation. The previous version of this file had every box unchecked
> while `Progress.md` simultaneously claimed 100% completion — those two
> documents contradicted each other. This version reflects what's actually
> in the repo, verified against source where noted.

## 1. Core Cryptographic & Backend Implementation (PQC ML-DSA-65)

- [x] **1.1 Flask Crypto Service** — ML-DSA-65 keygen/sign/verify implemented
  via real `liboqs-python` (`keygen.py`, `pq_sign.py`), not a stub. Bound to
  `0.0.0.0:5001` with HTTPS (self-signed cert fallback in `app.py`).
- [x] **1.2 Verification API Gateway** — Express gateway on `0.0.0.0:3000`,
  Shamir k=3/n=5 dispatch logic implemented and wired to the crypto service.
- [ ] **AJV schema validation** — claimed in the original TODO, **not actually
  present**: `ajv` is not a dependency in `verification-api/package.json`.
  Current input handling is manual regex stripping in `routes/issue.js`
  (strips `<>'"&;`). This works for the current fields but isn't the same
  guarantee as schema validation, and doesn't scale as claim fields grow.
  **Still open** — either add AJV for real or update docs to describe what's
  actually there.

## 2. Zero Trust Internal Communication & ZTA Mesh

- [x] **2.1 Bearer token auth** — `SHARD_NODE_API_KEY` / `CRYPTO_SERVICE_API_KEY`
  enforced on inter-service calls; confirmed via `test_all.sh` and route code.
- [ ] **Docker network default-deny policies** — `docker-compose.yml` defines
  a bridge network (`scatterid_net`) but explicit default-deny ingress/egress
  rules weren't independently confirmed in this pass. Worth a direct check
  before claiming this in docs.
- [x] **2.2 Parameterized SQL** — shard nodes use prepared statements
  (no evidence of raw string interpolation found in `shard-node/server.js`).

## 3. Sharded Storage & Fault-Tolerant State Synchronization

- [x] **3.1 Multi-database shard isolation** — 5 isolated SQLite containers,
  confirmed via `docker-compose.yml` and `shard-node` structure.
- [x] SHA-256 share checksums — confirmed in `shamir.py` (checksum appended
  to each hex-encoded share).
- [x] **3.2 Fault-tolerant verification & auto-healing** — the k=3/n=5
  boundary is genuinely tested, not just claimed: 5/5, 4/5, 3/5 online all
  verify successfully; 2/5 fails deterministically. `POST /heal-shards`
  reconstructs and backfills missing shares. This is the strongest, most
  well-evidenced part of the system.

## 4. Hyperledger Fabric Immutable Anchoring

- [x] **4.1 Chaincode & network** — `scatterproof.go` implements
  `AnchorProof`/`QueryProof`; `fabric.js` uses the real
  `@hyperledger/fabric-gateway` SDK with proper mTLS identity/signer setup,
  not a mock.

## 5. Production Readiness

- [ ] **5.1 Container hardening** — **not done**. Both `crypto-service` and
  `verification-api` Dockerfiles are single-stage; build toolchains
  (`git`, `cmake`, `build-essential`, `python3`, `make`, `g++`) ship in the
  final image instead of being discarded after compilation.
- [ ] **Healthchecks & restart policies** — **not present** in
  `docker-compose.yml` (`healthcheck:` / `restart:` — zero occurrences).
- [x] **Debug mode disabled** — `crypto-service/app.py` previously ran Flask
  with `debug=True` (Werkzeug interactive debugger is a real RCE surface if
  ever reachable). Fixed in this remediation pass to be env-gated, default off.
- [x] **Committed key material removed** — Fabric `priv_sk` files were
  tracked in git. Removed from working tree in this pass; **still present in
  git history** — see `REMEDIATION_NOTES.md` for the purge steps, which are
  a separate, deliberate action.
- [x] **TLS bypass removed** — `.env.example` shipped both a proper CA trust
  path (`NODE_EXTRA_CA_CERTS`) and a global bypass
  (`NODE_TLS_REJECT_UNAUTHORIZED=0`) that silently defeated it and
  contradicted the README's TLS claims. The bypass line is removed.
