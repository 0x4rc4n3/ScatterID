# ScatterID Remediation Plan
Audit date: 2026-08-26 · Repo: `0x4rc4n3/ScatterID-product` (commit `75ea7bd`)

This is a punch list of every concrete problem found in the repo, ranked by severity, each with a ready-to-use prompt you can hand to yourself or an AI coding agent to fix it. Work top to bottom — P0 items are things that would fail a security review on sight; P3 items are portfolio polish.

---

## P0 — Critical security (fix before showing this to anyone technical)

### 1. TLS certificate verification is globally disabled in the verification-api
**Where:** `components/verification-api/src/server.js`, line 1: `process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';` (also set again in `docker-compose.yml`).
**Why it matters:** This disables certificate validation for *every* outgoing HTTPS request the Node process makes, for the entire lifetime of the process — not just the one connection to crypto-service. In a product whose entire pitch is PQC-secured transport, shipping a hardcoded MITM hole in the gateway is the single worst finding in the repo, and it's the first thing a reviewer who greps the code will find.
**Prompt:**
> Remove the line `process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'` from `src/server.js` and the corresponding `NODE_TLS_REJECT_UNAUTHORIZED: "0"` line from `docker-compose.yml`. Instead, trust the crypto-service's self-signed CA properly: generate a dedicated CA cert for local/dev use in `generate_certs.sh`, mount it into the verification-api container, and pass it via `NODE_EXTRA_CA_CERTS` (already partially wired in docker-compose) so Node validates against that CA instead of disabling validation altogether. Confirm `curl`/fetch calls from verification-api to crypto-service still succeed with full certificate validation on. Add a comment explaining the CA trust chain for future readers.

### 2. Docker socket mounted into the dashboard container
**Where:** `docker-compose.yml`, `project-dashboard` service: `- /var/run/docker.sock:/var/run/docker.sock`.
**Why it matters:** This gives any process inside the dashboard container root-equivalent control over the host's Docker daemon — it can start/stop/create arbitrary containers, including privileged ones that mount the host filesystem. Combined with finding #3 (no auth on the dashboard), this is a full host-compromise path for anyone who can reach port 4000.
**Prompt:**
> Remove the `/var/run/docker.sock` bind mount from the `project-dashboard` service. Replace the dashboard's direct `docker ps` / `docker logs` shell calls (`server.js`, `runCmd()`) with calls to the Docker Engine API over a read-only, scoped proxy (e.g. a small sidecar using `docker-socket-proxy` restricted to `GET /containers/json` and `GET /containers/{id}/logs`), or — simpler for a portfolio project — replace the live docker introspection with each service self-reporting health over HTTP (`/healthz` endpoints) that the dashboard polls, removing the Docker socket dependency entirely.

### 3. Dashboard has zero authentication on any route
**Where:** `components/project-dashboard/server.js`. `GATEWAY_API_KEY` is read from env (line 19) but never referenced anywhere else in the file — no middleware checks it.
**Why it matters:** Every dashboard route is reachable by anyone with network access to port 4000, including `POST /api/settings/rotate`, which triggers live cryptographic key rotation on the verification-api with no credential check at all, and `GET /api/logs/:container`, which dumps container logs. The API key variable exists purely as decoration — it does nothing today.
**Prompt:**
> Add Express middleware in `server.js` that requires a valid `Authorization: Bearer <GATEWAY_API_KEY>` (or a signed session cookie for a real login flow) on every `/api/*` route, using `crypto.timingSafeEqual` for the comparison (not `===`). Return 401 with no body detail on failure. Add a test that hits `/api/settings/rotate` and `/api/logs/scatterid-crypto` without a key and asserts 401. Also fail startup loudly (like `crypto-service/app.py` already does) if `GATEWAY_API_KEY` is unset or equals the literal fallback `'disabled'`, so it can never silently run open.

### 4. Weak default secrets baked into `docker-compose.yml`
**Where:** `CRYPTO_SERVICE_API_KEY: "${...:-dev-secret-key-123}"`, `VAULT_TOKEN: "${...:-scatterid-vault-root-token}"`, `GATEWAY_API_KEY: "${...:-scatterid-test-api-key-999}"`.
**Why it matters:** If any environment variable isn't set at deploy time, the stack silently falls back to these guessable defaults — and `config.json` explicitly declares `"env": "production"`. A misconfigured deploy doesn't fail closed, it fails open with a well-known root Vault token.
**Prompt:**
> Remove all `:-<default>` fallbacks for secret-bearing environment variables in `docker-compose.yml`. Require them to be set via a `.env` file (already gitignored) or a secrets manager, and make every service fail fast at startup with a clear error if the variable is empty (the crypto-service's `API_KEY` check is the right pattern — replicate it for `VAULT_TOKEN` and `GATEWAY_API_KEY`). Add a `.env.example` listing every required variable with placeholder values and a comment that real values must never be committed.

### 5. `config.json` is committed to git despite being in `.gitignore`
**Where:** repo root `config.json`, tracked (confirm with `git ls-files | grep config.json`).
**Why it matters:** Adding a path to `.gitignore` does nothing for a file that was already tracked before the rule existed — it stays tracked and every future edit (including one that fills in real Vault tokens or API keys, since the file's own header calls itself "highly sensitive") gets committed and pushed. This is a live secret-leak footgun, not a hypothetical one.
**Prompt:**
> Run `git rm --cached config.json components/project-dashboard/config.json` to untrack both files while leaving them on disk, then commit that removal. Verify `.gitignore` actually covers them going forward with `git check-ignore -v config.json`. Add a `config.example.json` with the same structure and empty/placeholder values, committed normally, so new setups have a template. Document this in the setup README: "copy config.example.json to config.json and fill in secrets locally; never commit config.json."

### 6. Vault wired over plain HTTP with a root token in a config that claims "production"
**Where:** `docker-compose.yml`: `VAULT_ADDR: "http://vault.scatterid.com:8200"`; `kms.py`'s HTTPS-enforcement check whitelists any hostname containing the substring `"vault"`, so this passes the check while still being plaintext HTTP.
**Why it matters:** The KMS class docstring calls itself "Production-grade," and `config.json` sets `system.env` to `"production"`, but the actual wiring sends the Vault root token and PQC private key material over unencrypted HTTP. The hostname-substring escape hatch (`"vault" in url`) is also a weak way to detect "local" — it would just as easily pass `http://vault.attacker.com`.
**Prompt:**
> Change the local/dev detection in `kms.py` to check for an explicit `VAULT_DEV_MODE=true` environment flag rather than string-matching the URL, and default `VAULT_DEV_MODE` to false. Update `docker-compose.yml` to run Vault with TLS enabled (Vault supports this natively via `listener "tcp" { tls_cert_file = ... }`) and change `VAULT_ADDR` to `https://vault.scatterid.com:8200`, mounting a cert generated by `generate_certs.sh`. Update `README.md`'s security section to state plainly that the current setup is dev/demo-only if you don't do this, rather than implying production-readiness.

---

## P1 — High-priority engineering gaps

### 7. No CI/CD actually exists despite a doc describing one
**Where:** `docs/5.CI-CD & DevOps.txt` describes a pipeline; there is no `.github/workflows/` directory anywhere in the repo.
**Why it matters:** Right now the docs describe aspirational process, not implemented process. Any technical reviewer (or interviewer) who checks will notice the gap immediately, and it undercuts every other document's credibility.
**Prompt:**
> Create `.github/workflows/ci.yml` with at minimum: (1) a job that lints and runs `npm test` for `sdk/` and `components/verification-api/`, (2) a job that runs `pip install -r requirements.txt` and `python -m pytest` (or `unittest`) for `components/crypto/crypto-service/`, (3) a `docker compose build` job to catch Dockerfile breakage, and (4) a dependency-audit step (`npm audit --production`, `pip-audit`) that fails the build on high/critical CVEs. Badge the README with the workflow's status badge once it's green.

### 8. Test coverage is a handful of smoke/unit tests, not "rigorous validation"
**Where:** `test_all.sh` is four curl checks; `sdk/test/index.test.ts` is one file; `crypto-service/test_interface.py` is one test case; `verification-api/tests/verification.test.js` is one file.
**Why it matters:** This is fine to *say* honestly ("I have smoke tests, not full coverage") but it should not be described as validated or production-ready anywhere in docs or the SOP. Given this is literally the thesis of your Statement of Purpose (I can prototype, I need training in rigorous validation), closing part of this gap for real will make that story land much better in an interview.
**Prompt:**
> For `crypto-service`: add unit tests for `pq_sign.py` (round-trip sign/verify, tampered-signature rejection, wrong-algorithm rejection, empty-input rejection) and `kms.py` (key rotation preserves old keys in history, `zeroize()` actually clears the buffer, Vault-unreachable failure mode). For `verification-api`: add tests for `routes/issue.js` and `routes/verify.js` covering idempotency-key replay, tampered dataHash detection, revoked-credential rejection, and crypto-service-unreachable handling — mock the fetch calls rather than requiring a live Vault/Fabric stack. Wire both suites into the CI workflow from item 7 and report coverage percentage in the README.

### 9. Inconsistent snake_case/camelCase field names between SQLite and JS
**Where:** `routes/verify.js`: `record.data_hash || record.dataHash`, `record.issued_at || record.issuedAt` — defensive fallbacks scattered through the route instead of a single normalization point.
**Why it matters:** This is a classic sign of glued-together code where the DB layer and the API layer were never reconciled — every route that touches a `credentials` record has to remember both naming conventions or it silently breaks. It's exactly the kind of "surface-level integration" the SOP describes.
**Prompt:**
> In `db/models.js`, add a small mapper function `toApiShape(row)` that converts the raw SQLite row (snake_case) into a single canonical camelCase object, and have every exported function (`getCredentialById`, `getAllCredentials`, etc.) return through that mapper. Then delete every `a || b` fallback in `routes/verify.js` and `routes/issue.js` and reference only the camelCase field. Add a unit test asserting the mapper output shape.

### 10. No rate limiting or standard security headers on either Express service
**Where:** `verification-api/src/server.js`, `project-dashboard/server.js` — no `helmet`, no rate limiter anywhere.
**Why it matters:** A public-facing verification/issuance endpoint with no rate limiting is trivially abusable for credential-issuance spam or brute-forcing idempotency keys; missing security headers (HSTS, CSP, X-Content-Type-Options) is a baseline OWASP ASVS item the project's own security doc claims to follow.
**Prompt:**
> Add `helmet` and `express-rate-limit` to both `verification-api` and `project-dashboard`. Apply `helmet()` globally. Rate-limit `/issue` and `/verify` to something sane for a demo (e.g. 30 req/min per IP) and return 429 with a `Retry-After` header on breach. Document the limits in the README's API section.

### 11. Unindexed linear scan fallback in `/verify`
**Where:** `routes/verify.js`: when `credentialId` is omitted, it calls `getAllCredentials()` and does `all.find(...)` in JS.
**Why it matters:** This is O(n) per verification call and loads the entire credentials table into memory every time — fine for a demo, a real scalability bug at any volume, and also a needless attack surface (an unauthenticated caller can force a full table scan repeatedly).
**Prompt:**
> Add a `UNIQUE INDEX` on `credentials.data_hash` in `db/models.js`'s schema, add a `getCredentialByDataHash(hash)` prepared statement, and use it directly instead of `getAllCredentials().find(...)`. Alternatively, make `credentialId` a required field on `/verify` and remove the fallback path entirely if the lookup-by-hash use case isn't actually needed — document the decision either way.

### 12. Dashboard uses `exec()` with string interpolation instead of `execFile`
**Where:** `project-dashboard/server.js` line 277: `` runCmd(`docker logs --tail 100 ${container}`) ``.
**Why it matters:** It's currently guarded by a whitelist (`validContainers.includes(container)`), so it isn't exploitable today, but shell-string interpolation is a pattern that becomes a vulnerability the moment anyone loosens the whitelist later without noticing the risk. Defense in depth matters more in a security-branded project than most others.
**Prompt:**
> Replace `exec()` + template-literal command strings with `execFile('docker', ['logs', '--tail', '100', container])` throughout `server.js`, passing arguments as an array so there is no shell involved at all. Keep the `validContainers` whitelist check as an additional layer. Do the same for the `docker ps` call.

### 13. Certificate generation is silently swallowed on failure at app startup
**Where:** `crypto-service/app.py`, `ensure_certificates()`: both `subprocess.run` calls are wrapped in bare `except Exception: pass`.
**Why it matters:** If cert generation fails, the app proceeds to call `app.run(..., ssl_context=(EFFECTIVE_CERT, KEY_PATH))` with paths that may not exist, producing a confusing crash far from the real cause — bad failure mode for a service whose whole job is being trustworthy about crypto material.
**Prompt:**
> In `ensure_certificates()`, replace both bare `except Exception: pass` blocks with logging the actual error (`app.logger.error` or `print` to stderr with the exception) and re-raising if the resulting cert/key files don't exist afterward, so the process fails at startup with a clear message instead of failing later inside Flask's SSL setup.

---

## P2 — Documentation & process honesty

### 14. Several docs explicitly say they describe a superseded architecture
**Where:** `docs/6.Security Engineering.txt`, `docs/7.Testing & QA.txt` both open with "This document reflects the original v1 architecture... ScatterID has since been upgraded to a Zero-Knowledge hashing model (v2)." Both are also titled "Crypto Project," not ScatterID.
**Why it matters:** Stale docs that admit they're stale, still sitting in the repo as if current, look worse than no docs — and the generic "Crypto Project" title suggests these were adapted from a template rather than written for this system specifically.
**Prompt:**
> Rewrite `docs/6.Security Engineering.txt` and `docs/7.Testing & QA.txt` (or merge their still-relevant sections into `docs/ScatterID Architecture.txt`) to describe the actual current v2 zero-knowledge design: hash-commitment issuance/verification flow, ML-DSA-65 signing, Fabric anchoring, Vault-backed KMS. Retitle both from "Crypto Project" to "ScatterID." Delete the stale v1-specific content rather than leaving a disclaimer on top of it — a disclaimer that a doc is outdated is not the same as it being useful.

### 15. No LICENSE, SECURITY.md, or CONTRIBUTING.md
**Where:** repo root.
**Why it matters:** No LICENSE means the legal default is "all rights reserved" — nobody (including an admissions committee or future employer) can legally reuse, fork, or even clearly evaluate the code's intended openness. No SECURITY.md is a specific miss for a security-branded project — the standard convention (`/.well-known/security.txt` or `SECURITY.md`) for how to responsibly report a vulnerability is exactly the kind of "process maturity" signal a security-focused grad program or employer looks for.
**Prompt:**
> Add a `LICENSE` file (MIT or Apache-2.0 is standard for a portfolio project like this — pick one and say why in the README). Add `SECURITY.md` describing supported versions and how to report a vulnerability (even if it's just "email X, do not open a public issue"). Add `CONTRIBUTING.md` with setup instructions pointing to `docs/SETUP_AND_USAGE.md` and `check_deps.sh`.

### 16. No explicit "Known Limitations" section in the README
**Where:** `README.md`.
**Why it matters:** Right now the README reads as if the system is complete and secure ("Production-grade Key Management Service," "MANUAL REVIEW REQUIRED" security note) with no acknowledgment of the real gaps this audit found (no CI, thin test coverage, dev-mode Vault, no external audit). Stating limitations explicitly is *more* credible to a technical reader than silence, and it directly supports the honest narrative your SOP is trying to tell.
**Prompt:**
> Add a "## Current Limitations" section to `README.md` listing, plainly: no independent security audit has been performed; test coverage is smoke-level, not comprehensive; the default docker-compose configuration is for local development only and is not hardened for production deployment (link to whichever of the above items remain unresolved); CI is present but does not yet include SAST/dependency-scanning (until item 7 is done, say so honestly).

### 17. No CHANGELOG despite meaningful architectural revisions (v1 → v2)
**Where:** repo root.
**Why it matters:** The git log has real, describable milestones (MVP scaffold → components restructure → zero-knowledge refactor → security remediation) that would make a strong "here's how the project evolved" narrative for interviews, but there's nowhere a reader can see that arc without reading the raw git log.
**Prompt:**
> Add `CHANGELOG.md` following Keep a Changelog format, reconstructing entries from `git log --oneline` (initial MVP scaffold, component restructuring, zero-knowledge architecture refactor, dependency/documentation cleanup passes, crypto vulnerability remediation). This becomes reusable material for your SOP and interviews — a real changelog is more convincing evidence of iterative engineering than a paragraph describing it.

---

## Suggested execution order

1. Do all of **P0** first (items 1–6) — these are the ones a security-literate reader would flag immediately, and several are one-line-to-moderate fixes.
2. Do **P1** items 7 and 8 together (CI + tests) since the new tests should run in the new pipeline from the start.
3. Do the rest of **P1** (9–13) as focused, single-purpose commits — each is small enough to be its own clean commit message, which also improves your commit history for portfolio purposes.
4. Do **P2** last, once the technical fixes are real — writing documentation that says "we have CI and real tests" is only honest after items 7–8 are done.

Once this list is clear, I can help fact-check the SOP language against the *post-fix* state of the repo — at that point "conceptual" becomes an understatement rather than an overstatement, which is a much better place to write from.
