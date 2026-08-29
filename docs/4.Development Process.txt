# ScatterID - Development & Operations Documentation

---

## Dev Environment & Git Workflow

### Purpose

This guide exists so no one loses their first day to setup confusion or unclear process. Follow it exactly; if something doesn't work, ask in your team channel before improvising — improvised setup is a common source of "works on my machine" bugs later.

### Repository Access

1. You'll be added to exactly one module repository under the Project Lattice GitHub organization — not the full project, just your module.
2. Clone only your assigned repo. Do not request access to other module repos — if you need to know something about another module, ask your track lead, don't go looking.
3. Your repo will already have a README with module-specific setup steps (language version, package manager) — follow that alongside this general guide.

### Branching Model

```
main → always working, protected, no direct pushes
│
└─ dev → integration branch for your module team
    │
    └─ feature/<short-description> → your working branch
    
```

- Branch off `dev`, never off `main` directly.
- One feature branch per task/function — keep branches small and focused, not one giant branch for the whole module.
- Delete your feature branch after it's merged.

### Commit Messages

Use a consistent, readable format — this matters more than people expect when someone else has to review or debug your history later.

```
<type>: <short description>

Examples:
feat: implement split_secret function
test: add round-trip test for interface.py
docs: add usage example to README
```

### Pull Request Process

1. Push your feature branch and open a PR against `dev` (not `main`).
2. PR description must include: what you built, what's tested, what's still open or uncertain. Use the template your track lead provides if one exists.
3. Your track lead reviews within 2-3 working days — if you haven't heard back, ping the team channel rather than waiting silently.
4. Address review comments with new commits on the same branch — don't force-push over review history unless asked to.
5. Once approved, your track lead merges it. Only track leads merge into `dev`; only founders merge `dev` into `main`.

### Local Setup Checklist

- Install the language runtime specified in your module's README (exact version, not "latest" — version mismatches cause subtle bugs).
- Create a virtual environment (Python) or use the lockfile (Node.js: `npm ci`, not `npm install`, to match exact dependency versions).
- Copy `.env.example` to `.env` and fill in any keys/credentials your track lead provides — never commit `.env` files.
- Run the existing test suite once, even before writing anything, to confirm your environment is set up correctly.

### Getting Testnet / Sandbox Credentials

If your module needs testnet access, API keys, or sandbox credentials, request them from your track lead directly — do not generate your own or use production-adjacent services. Credentials will be shared through a secure channel (not posted in open Discord channels).

### When You Get Stuck

1. Re-read your module's TODO doc and this guide — many blockers are answered in what's already written.
2. Check existing tests and README for expected behavior/examples.
3. Post in your team's channel with: what you're trying to do, what you tried, the exact error — not just "it's not working."
4. If it's a scope or design question (not a bug), escalate to your track lead rather than guessing and building the wrong thing.

### What Not To Do

- Don't push directly to `main` or `dev` — always go through a PR, even for small changes.
- Don't commit secrets, API keys, or `.env` files — use `.gitignore` and check before every commit.
- Don't install or introduce a new major dependency without checking with your track lead first — it may conflict with a decision already locked in the Architecture Decision Record.
- Don't try to access or infer details about other modules — build against the interface contract you were given, nothing more.

---

## Coding Standards & Style Guide

### General Principles (All Languages)

- Clarity over cleverness — code will be read by teammates and reviewed by founders who need to reason about security implications quickly.
- No cryptographic primitives implemented by hand, ever — use the libraries specified in the Cryptographic Design Document.
- No secrets, keys, or credentials hardcoded anywhere in source — always environment variables or a secrets manager.
- Every public function must have a docstring/comment describing inputs, outputs, and any side effects.
- Fail loudly and specifically — avoid silent catch-and-ignore error handling, especially in cryptographic or security-relevant code paths.


| Function | Input | Output |
|----------|-------|--------|
| Style guide | PEP 8 | Enforced via linter (see Section 5) |
| Formatter | black (default settings) | Auto-formats on save/commit — removes style debates entirely |
| Linter | ruff or flake8 | Catches unused imports, undefined names, common bugs |
| Type hints | Required on all function signatures | Especially important here — catches shape mismatches against the Interface Contract early |
| Docstring style | Google-style docstrings | Args/Returns/Raises sections, consistent across the codebase |

```python
def split_secret(secret: bytes, n: int, k: int) -> list[Share]:
    """Split a secret into n Zero-Knowledge Verification shares with threshold k.

    Args:
        secret: The raw secret bytes to split.
        n: Total number of shares to generate.

    Returns:
        A list of n Share objects.

    Raises:
        ValueError: If k > n or k < 1.
    """
```

### Node.js (Verification API, SDK)

| Function | Input | Output |
|----------|-------|--------|
| Style guide | Airbnb JavaScript Style Guide (or StandardJS — pick one, note choice in ADR) | Consistency matters more than which specific guide is chosen |
| Formatter | Prettier | Auto-formats on save/commit |
| Linter | ESLint with the chosen style guide's config | Run in CI on every PR |
| Language | TypeScript preferred over plain JS where practical, especially for the SDK | Type safety catches interface-contract mismatches at compile time rather than runtime |
| Async style | async/await, not raw Promise chains or callbacks | More readable, easier to add proper error handling around |

```typescript
/**
 * Issues a new credential via the API.
 * @param {IssueRequest} payload
 * @returns {Promise<{credentialId: string, anchorTxId: string}>}
 * @throws {ScatterAPIError} on non-2xx response
 */
async function issueCredential(payload) { /* ... */ }
```

### Go (Chaincode)

| Function | Input | Output |
|----------|-------|--------|
| Style guide | Effective Go + gofmt (Go's standard, non-negotiable) | gofmt is not optional — it's the language's built-in standard |
| Linter | golangci-lint | Catches common Go-specific issues (unchecked errors, ineffectual assignments) |
| Error handling | Always check and handle returned errors explicitly — never `_ = err` | Especially critical in chaincode, where a swallowed error could mean a silent access-control bypass |
| Comments | Exported functions must have a comment starting with the function name (Go convention) | Required for godoc generation and code review clarity |

### Linting & Formatting Enforcement

All formatters/linters run automatically via the CI pipeline on every pull request. A PR with linting failures cannot be merged — this is enforced by CI status checks, not left to reviewer discretion.

### Naming Conventions

- Functions/variables: match each language's idiomatic convention (snake_case for Python, camelCase for JS/Go) — don't mix conventions within a single language's codebase.
- No abbreviations that aren't immediately obvious — `credentialId` not `credId`, `signature` not `sig`, except where the Interface Contract already specifies a shorter name.

### Security-Specific Code Practices

- Never log full request/response bodies that might contain sensitive data — log structured, redacted summaries instead.
- Input validation happens at the API boundary before data reaches any internal service — don't rely on downstream services to re-validate.
- Any code touching cryptographic material (keys, shares, signatures) requires review from a founder or crypto-track lead, regardless of who wrote it — see Code Review Checklist.

---

## Branching & Release Strategy

### Branch Structure (Per Module Repo)

```
main → always deployable, protected, no direct pushes
│
└─ dev → module team's integration branch
    │
    └─ feature/* → individual task branches
    └─ fix/* → bugfix branches
```

This matches the Dev Environment & Git Workflow Guide already distributed to module teams. This document extends that with release-level and cross-module coordination, which is founder-level responsibility, not module-team-level.

### Founders-Only Integration Repo Branching

```
main → production-ready, tagged releases only
│
└─ integration → where merged module code lands first
    │
    └─ module-sync/* → one branch per module pulled in for integration testing
```

1. Each module team's `main` branch (once stable) is pulled into a `module-sync/<module-name>` branch in the integration repo.
2. Founders run cross-module integration tests on the `integration` branch before anything reaches the real `main`.
3. Only `main` is ever deployed — `integration` is a staging ground, not a deployable state.

### Versioning Scheme

Semantic Versioning (MAJOR.MINOR.PATCH) applied at the integration repo level:

- **MAJOR:** breaking changes to the Interface Contract (e.g. SignedCredential shape changes incompatibly)
- **MINOR:** new functionality added without breaking existing integrations (e.g. new endpoint, new SDK method)
- **PATCH:** bug fixes, security patches, no interface changes

Module repos can version independently for internal tracking, but the integration repo's version is what's communicated externally (e.g. to SDK consumers, pilot customers).

### Release Process

1. Confirm all module-sync branches pass integration tests on the `integration` branch.
2. Run the full security/test checklist before any release touching production infrastructure.
3. Tag the release on `main` following semantic versioning (e.g. `v0.3.0`).
4. Write release notes: what changed, any breaking changes, migration steps if applicable (especially important for SDK consumers).
5. Deploy following the phase-appropriate process (see Network Topology document — Phase 1/2/3 progression applies to releases too, not just initial setup).

### Hotfix Process (Security Issues)

1. Security fixes bypass the normal module-sync cadence — branch directly from `main` as `hotfix/<short-description>`.
2. Minimum one founder review required, but do not let review speed compromise release speed for confirmed active vulnerabilities — balance carefully, err toward faster fix + follow-up hardening.
3. After deployment, back-merge the hotfix into `integration` and all active module-sync branches so the fix isn't lost in the next regular release.
4. Document the incident per the Key Management Policy's incident response process if it involved cryptographic material, or the future Incident Response Runbook otherwise.

### Release Cadence (Suggested)

| Function | Input | Output |
|----------|-------|--------|
| Phase 0-1 (MVP build) | No fixed cadence — release to internal integration repo as modules stabilize | Focus on correctness over shipping speed while the core is unproven |
| Phase 2 (SDK + hardening) | Weekly internal releases to integration/staging | Regular cadence builds the release muscle before real customers are involved |
| Phase 3+ (pilot and beyond) | Deliberate, reviewed releases — no fixed schedule, but every release requires the full checklist | A live pilot customer means release discipline matters more than speed |

---

## Code Review Checklist

### General Checklist (Every PR, Every Module)

- [ ] Code matches the Interface Contract exactly, if it touches a shared data shape
- [ ] Follows the language's Coding Standards / Style Guide (linter/formatter passes in CI — don't re-litigate style manually)
- [ ] Tests included and passing, covering both success and failure/edge cases
- [ ] No hardcoded secrets, keys, or credentials anywhere in the diff
- [ ] Error handling is explicit — no silently swallowed exceptions, especially around cryptographic or security-relevant operations
- [ ] No new dependency added without checking it against the Architecture Decision Record's locked stack
- [ ] Commit messages and PR description are clear and follow the established format

### Additional Checklist — Cryptographic Code (Mandatory Founder/Crypto-Lead Review)

**⚠ Any PR touching signing, key handling, secret-sharing, or hashing logic requires review from a founder or the designated crypto-track lead, regardless of who authored it — no exceptions, even for small changes.**

- [ ] No custom implementation of any cryptographic primitive — confirms library usage only, per the Cryptographic Design Document
- [ ] Randomness sourced from a CSPRNG, never a general-purpose random function
- [ ] Keys/shares never logged, printed, or included in error messages
- [ ] Function signatures match the Interface Contract's SignedCredential / Share formats exactly
- [ ] Algorithm identifiers are parameterized, not hardcoded, per the algorithm agility note in the Cryptographic Design Document

### Additional Checklist — API / Backend Code

- [ ] All inputs validated and rejected cleanly if malformed — no assuming well-formed input from callers
- [ ] Authentication (API key) enforced on every route, no accidental unauthenticated endpoints
- [ ] Error responses are generic to the client; detailed errors only in internal logs
- [ ] No raw sensitive data (claims, full shares) ever appears in a request or response body — references and hashes only
- [ ] Rate limiting / abuse considerations addressed for any new public-facing endpoint

### Additional Checklist — Chaincode

- [ ] Access control enforced within the chaincode logic itself (via MSP identity checks), not assumed to be handled elsewhere
- [ ] No PII or raw claim data written to ledger state, even indirectly
- [ ] Endorsement policy implications considered for any new state-changing function
- [ ] Tested against an actual Fabric test network, not just unit-mocked

### Reviewer Response Standards

1. Review within 2-3 working days of PR submission — if you can't, say so in the PR rather than leaving it silent.
2. Be specific: point to the exact line/concern, don't just say "this looks off."
3. Distinguish blocking issues (must fix before merge) from suggestions (nice-to-have, can be a follow-up) explicitly in your comments.
4. For intern-authored PRs, treat review as a teaching moment where possible — explain *why* something needs to change, not just *what*.

### Merge Criteria

A PR can be merged only when: all CI checks pass (lint, tests), all mandatory checklist items for its category are satisfied, at least one approving review is given (two for anything touching cryptographic code), and any blocking comments are resolved — not just acknowledged.

---

## Definition of Done

### Purpose

Each module's individual TODO document already lists a module-specific Definition of Done. This document consolidates those, and adds the project-wide bar that applies once modules are integrated — the standard founders should hold the merged product to before calling any phase "complete."

### Module-Level Definition of Done (Summary)

| Function | Input | Output |
|----------|-------|--------|
| Fragmentation module (Crypto) | All functions match Interface Contract exactly; tests pass including k-1 share failure case; README with working example; no hand-rolled crypto math | Most safety-critical module — hold to the highest scrutiny |
| Verification API (Backend) | All 3 endpoints implemented and tested including error paths; anchoring verified on testnet/block explorer; no raw sensitive data stored or logged; API key required on every route | Integration point for both other technical modules |
| Security review | Threat model completed before testing began; static analysis run and triaged; fuzz harness run on signature verification; every finding documented with severity and verified fix | Ongoing/recurring, not a one-time deliverable |
| SDK/DevOps/Docs | All SDK methods tested against real sandbox API; integration demo runs end-to-end unmodified; CI pipeline runs lint+tests automatically; a new developer can follow quickstart without asking questions | Judged by ease-of-use, not just functional correctness |

### Project-Wide Definition of Done (Applies After Module Integration)

A phase (per the Roadmap document) is not "done" until all of the following hold true across the integrated system, not just within individual modules:

2. All module-level Definitions of Done are satisfied for every module involved in that phase.
3. Cross-module integration tests pass on the founders-only `integration` branch (see Branching & Release Strategy).
4. No component of the flow ever stores, logs, or transmits raw claim data, complete secret shares, or private keys outside their defined, approved locations.
5. Security review has signed off on the integrated flow, not just individual modules in isolation — integration often introduces new attack surface that module-level review can't catch.
6. Documentation (API spec, SDK docs, architecture docs) reflects the actual current state of the system, not an earlier draft.

### Phase-Specific Additions to Definition of Done

| Function | Input | Output |
|----------|-------|--------|
| Phase 1 (local ledger) | Chaincode functions tested locally; single-peer flow works end-to-end | Fault tolerance not yet meaningfully testable — not required at this phase |
| Phase 3 (cloud, public IP) | TLS configured between all nodes; firewall rules restrict Fabric ports to known node IPs; API is the only publicly exposed surface; secrets moved out of env-vars into a proper secrets manager | Do not consider Phase 3 "done" on functionality alone — the security posture upgrade is part of the definition, not a follow-up |

### What "Done" Explicitly Does Not Mean

- "Done" does not mean "ready for real customer data" — that additionally requires the security audit and legal/compliance review noted in the Roadmap's Phase 4.
- "Done" does not mean "feature-complete" — P1/P2 requirements from the PRD are intentionally deferred; done means the P0 scope for that phase is solid, not that everything imaginable has been built.
- "Done" for a module does not mean "done" for the project — always check the project-wide criteria before considering a phase complete.

---

## Summary: Development Workflow Quick Reference

| Topic | Key Points |
|-------|------------|
| **Repository** | One repo per module + founders-only integration repo |
| **Branching** | feature/* → dev → main (module); module-sync/* → integration → main (integration) |
| **Commits** | `<type>: <short description>` (feat, fix, test, docs) |
| **PR Process** | PR against dev; track lead reviews; only leads merge to dev; only founders merge to main |
| **Review Timeline** | 2-3 working days; ping if no response |
| **Local Setup** | Exact language version; virtual env/npm ci; .env from example; run test suite |
| **Secrets** | Never commit; use env vars; request from track lead |
| **Linting** | CI-enforced; PR cannot merge with failures |
| **Python** | PEP 8, black, ruff, type hints, Google docstrings |
| **Node.js** | Airbnb/StandardJS, Prettier, ESLint, TypeScript preferred, async/await |
| **Go** | Effective Go, gofmt, golangci-lint, explicit error handling, godoc comments |
| **Versioning** | Semantic (MAJOR.MINOR.PATCH) at integration repo level |
| **Hotfix** | Direct from main; founder review; back-merge after deployment |
| **Definition of Done** | Module-level + project-wide criteria; phase-specific additions |

---

*This document consolidates all development and operations specifications for ScatterID.*