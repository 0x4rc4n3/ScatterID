# ScatterID — Master Execution Blueprint & Auto-Start Guide

> **TRIGGER INSTRUCTION:** When the user enters `"do @new/start"` (or `"do @new/start.md"`), read this file completely and immediately begin executing **Phase 1: Sub-Component 1.1** without requiring additional prompt context or design renegotiation.

---

## 1. Executive Context & System Architecture

You are building the **ScatterID v2.1 Operations, Access & Disaster Recovery Infrastructure**.

- **Core Repository (Source of Truth):** `/home/kali/scatterid-ecosystem/ScatterID`
- **Specification Directory:** `/home/kali/scatterid-ecosystem/new/`
- **Satellite Client Portal Repo (Deferred for now):** `/home/kali/scatterid-ecosystem/ScatterID-app`
- **Core Technology Stack:** Node.js (v18+), SQLite (WAL mode for atomic, zero-concurrency-conflict state), Hyperledger Fabric (Ledger / Chaincode), NIST FIPS 204 ML-DSA-87 (Post-Quantum Signatures via liboqs/Dilithium), WireGuard / iptables (Network isolation), Argon2id (Password hashing), Speakeasy / OTPAuth (TOTP RFC 6238).

### 1.1 Non-Negotiable Architectural Invariants
1. **Single Source of Truth (`ScatterID`):** All database schemas, authentication middleware, request moderation queues, auto-execution logic, dual-key rotation, and break-glass recovery utilities live in the `ScatterID` core repository.
2. **Zero Complex UI Frameworks During Build:** Do **NOT** install or configure Appsmith or Flowbite. Focus 100% on the backend APIs, business logic, cryptographic signing, and ledger dispatchers. Test all features using automated integration tests, `curl`, and **bare-bones raw HTML test harnesses** (`test_harness.html`).
3. **Scenario B: Tiered Risk Routing:**
   - **Hard-Channel Issuance** (physical document inspected in-person + Mod explicit approve) $\rightarrow$ **AUTO-EXECUTES on Hyperledger Fabric immediately**.
   - **Soft-Channel Issuance** (digital scan/PDF upload) $\rightarrow$ Mod review $\rightarrow$ **Strictly routes to Root's queue for final approval & execution**.
   - **Revocation Requests (Hard or Soft)** $\rightarrow$ **NEVER auto-executes under any condition**. Mandatory Root authorization and execution.
   - **Key Rotation** $\rightarrow$ Mod submits routine request; Root verifies and executes. Root has emergency rotation path.
   - **Rejections** $\rightarrow$ Closes request immediately at either tier.
4. **Mandatory Cryptographic Audit Attribution:**
   - Every transaction permanently stamps: `staff_user_id`, `username`, `station_id`, `client_ip`, `submission_channel` (`hard` / `soft`), and `timestamp`.
5. **Network Micro-Segmentation (3 Zones):**
   - **Zone 1: Counter VPN (`10.20.0.0/24`)**: Help Desk clerks connect over VPN. They can access **only** the Client Portal (`:3000`).
   - **Zone 2: Management Subnet (`10.10.0.0/24`)**: Ops Dashboard operators (Mod and Root) on port `:8080`.
   - **Zone 3: Core Dataplane (`127.0.0.1` / Docker bridge)**: Gateway (`:5000`), Fabric Peer (`:7051`), Orderer (`:7050`), PQC vault, SQLite DB.
   - **Firewall Rule:** Counter VPN clients are **strictly blocked / dropped** by `iptables` from accessing the Ops Dashboard (`:8080`) or backend ports.
6. **MFA, Passwords & Phone Migration:**
   - Mandatory TOTP (RFC 6238) for Mod and Root.
   - **Self-Service Phone Migration**: Admin verifies password in profile $\rightarrow$ scans new QR code $\rightarrow$ validates 6-digit code $\rightarrow$ DB updates secret and mints 8 new recovery codes. No SSH, zero server downtime.
   - 8 single-use recovery codes (SHA-256 hashed in SQLite).
   - Offline break-glass CLI: `tools/admin_cli.js`.
7. **PQC Key Distribution & Rotation:**
   - **Primary Standard (Advance Pre-Distribution)**: Future ML-DSA keys (`v2`, `v3`, `v4`) pre-generated 3–6 months in advance; public keys pre-staged on verifier keyrings.
   - **Emergency Fallback (Cryptographic Delegation Endorsement)**: If pre-staged keys are compromised, the active key signs a delegation token for fresh emergency keys, preserving offline verification without firmware pushes.
   - **Gateway Keys**: Dual-key zero-downtime rotation with 24–48h grace window.

---

## 2. Specification Index & Companion Documents

All files are located in `/home/kali/scatterid-ecosystem/new/`:
- `01-internal-dashboard-requirements-and-access.md`: Functional requirements, permission matrix, Mod/Root separation.
- `02-internal-dashboard-ui-ux-design.md`: Dashboard screen flows, Appsmith layouts, action modals.
- `03-client-portal-requirements-and-access.md`: Help Desk requirements, VPN network context, audit attribution.
- `04-client-portal-ui-ux-design.md`: Help Desk operational UI layout, physical inspection checklist.
- `05-README-documentation-overview.md`: Master index and system summary.
- `06-disaster-recovery-and-key-lifecycle.md`: Complete MFA, phone migration, break-glass CLI, PQC backups, and dual-key rotation specs.
- `07-network-topology-and-segmentation.md`: 3-zone network topology, WireGuard configuration, and `iptables` microsegmentation rules.
- `08-engineering-methodology-and-verification-architecture.md`: Atomic decomposition rules, defensive programming invariants, offline/online verification deep-dive.
- `verification-channel-and-escalation-addendum.md`: Normative Hard vs. Soft evidentiary standards and fraud escalation rules.

---

## 3. Git Branching & Workflow Rules

- **Target Repository:** `/home/kali/scatterid-ecosystem/ScatterID`
- **Master Integration Branch:** `feat/ops-dashboard` (currently created off latest `main`).
- **Atomic Sub-Branches:** Every sub-component is built in an isolated branch branched from `feat/ops-dashboard`:
  1. `feat/ops-step1-db-schema`
  2. `feat/ops-step2-auth-argon2-totp`
  3. `feat/ops-step3-request-queue`
  4. `feat/ops-step4-tiered-routing`
  5. `feat/ops-step5-key-lifecycle`
  6. `feat/ops-step6-breakglass-cli`
  7. `feat/ops-step7-raw-harness-tests`
  8. `feat/ops-step8-network-rules`
- **Merging Protocol:**
  - Complete sub-component $\rightarrow$ Run unit/integration tests $\rightarrow$ Verify zero regressions $\rightarrow$ Merge sub-branch into `feat/ops-dashboard` with `--no-ff` $\rightarrow$ Delete sub-branch.
- **NEVER PUSH TO REMOTE** unless the user explicitly commands `"push"`. Keep all work local.

---

## 4. Step-by-Step Execution Plan

When prompted with `"do @new/start"`, execute the following phases sequentially:

```
+---------------------------------------------------------------------------------------+
| PHASE 1: Database Schema & Migration Engine                                          |
| Branch: feat/ops-step1-db-schema                                                      |
| • Create SQLite schema with WAL mode & foreign keys enabled                          |
| • Tables: `users`, `recovery_codes`, `requests`, `audit_log`, `gateway_keys`,         |
|   `pqc_key_pool`, `delegation_endorsements`                                          |
| • Migration runner script & automated rollback test                                   |
+---------------------------------------------------------------------------------------+
                                           │
                                           ▼
+---------------------------------------------------------------------------------------+
| PHASE 2: Authentication & TOTP MFA Engine                                            |
| Branch: feat/ops-step2-auth-argon2-totp                                               |
| • Argon2id password hashing & verification                                            |
| • TOTP generation, validation, and secret encryption                                  |
| • Self-service phone migration route (`/api/auth/mfa/transfer`)                      |
| • Single-use recovery code authentication & invalidation                              |
| • Role-based auth middleware (`requireRole('clerk'|'mod'|'root')`)                    |
+---------------------------------------------------------------------------------------+
                                           │
                                           ▼
+---------------------------------------------------------------------------------------+
| PHASE 3: Request Intake & Audit Attribution Queue                                     |
| Branch: feat/ops-step3-request-queue                                                  |
| • Help Desk request intake routes (`POST /api/requests/issue`, `revoke`)             |
| • Channel validation (Hard checklist requirements vs. Soft scan upload & SHA-256)    |
| • Clerk audit attribution stamping (`staff_user_id`, `station_id`, `client_ip`)       |
| • Immutable audit logging hook on all queue state insertions                          |
+---------------------------------------------------------------------------------------+
                                           │
                                           ▼
+---------------------------------------------------------------------------------------+
| PHASE 4: Scenario B Tiered Risk Decision & Execution Engine                           |
| Branch: feat/ops-step4-tiered-routing                                                 |
| • Moderator decision routes (`POST /api/requests/:id/decide` - approve/reject/flag)   |
| • Auto-Execution Policy: Hard-Channel Issue + Mod Approve -> Fabric ledger execution  |
| • Soft-Channel Issue + Mod Approve -> Escalates to `AWAITING_ROOT_ACCEPT`           |
| • Revocation (Hard or Soft) + Mod Approve -> Strictly escalates to Root queue         |
| • Root execution routes (`POST /api/requests/:id/root-execute` - accept/reject)       |
| • Mod flag route with mandatory reason -> Escalates to `FLAGGED`                     |
+---------------------------------------------------------------------------------------+
                                           │
                                           ▼
+---------------------------------------------------------------------------------------+
| PHASE 5: PQC Key Lifecycle, Pre-Distribution & Dual-Key Grace                         |
| Branch: feat/ops-step5-key-lifecycle                                                  |
| • Zero-downtime dual-key gateway rotation with 24-48h grace window                    |
| • Pre-Distributed PQC Key Pool manager (generates & tracks pre-staged keys)          |
| • Cryptographic Delegation Endorsement generator (for emergency un-staged rotations)  |
| • AES-256-GCM encrypted PQC snapshot export & restore utility (`.enc`)               |
+---------------------------------------------------------------------------------------+
                                           │
                                           ▼
+---------------------------------------------------------------------------------------+
| PHASE 6: Offline Break-Glass Emergency CLI                                            |
| Branch: feat/ops-step6-breakglass-cli                                                 |
| • Build `tools/admin_cli.js` for bare-metal / host SSH emergency execution            |
| • Commands: `--reset-mfa`, `--reset-password`, `--export-backup`, `--rotate-pqc`      |
| • Renders terminal ASCII QR code and outputs fresh single-use recovery codes         |
| • Security alert logging directly to SQLite audit table                               |
+---------------------------------------------------------------------------------------+
                                           │
                                           ▼
+---------------------------------------------------------------------------------------+
| PHASE 7: Raw HTML Test Harness & End-to-End Integration Suite                         |
| Branch: feat/ops-step7-raw-harness-tests                                              |
| • Single-file zero-dependency raw HTML test dashboard (`public/test_harness.html`)   |
| • Simulates Clerk intake, Mod review queue, and Root execution console                |
| • Automated Jest/Mocha end-to-end integration test suite verifying all Scenario B     |
|   flows, MFA phone migrations, and failure edge cases                                 |
+---------------------------------------------------------------------------------------+
                                           │
                                           ▼
+---------------------------------------------------------------------------------------+
| PHASE 8: Network Micro-Segmentation & Firewall Scripts                                |
| Branch: feat/ops-step8-network-rules                                                  |
| • `scripts/network/apply_iptables.sh`: Blocks Counter VPN (10.20.0.0/24) from :8080   |
| • WireGuard server/client sample configs for Counter VPN and Management LAN           |
| • Network isolation verification test script                                          |
+---------------------------------------------------------------------------------------+
                                           │
                                           ▼
+---------------------------------------------------------------------------------------+
| PHASE 9: Final Review, Doc Sync & Merge to feat/ops-dashboard                         |
| • Mirror finalized documentation into `ScatterID/docs/ops-and-portal/`               |
| • Merge all validated sub-branches into `feat/ops-dashboard`                          |
| • Run master integration test suite                                                   |
| • Present clean summary report to user                                                |
+---------------------------------------------------------------------------------------+
```

---

## 5. First Action on `"do @new/start"`

1. Open `/home/kali/scatterid-ecosystem/ScatterID`.
2. Check `git status` and verify on branch `feat/ops-dashboard`.
3. Create sub-branch:
   ```bash
   git checkout -b feat/ops-step1-db-schema
   ```
4. Begin **Phase 1: Sub-Component 1.1** (SQLite Schema design in `packages/backend/src/db/` or `components/ops-dashboard/db/`).
5. Keep changes atomic, run tests, and report progress transparently.
