# ScatterID Engineering Issue Board & Verification Matrix
**Document ID:** SEC-BOARD-2026-V1  
**Classification:** Internal Engineering & Operational Governance  
**Repository Branching Status:** Clean `main` (all `issue-*` branches merged locally)

---

## 1. Project Issue Board Summary

| Issue ID | Branch Name | Component | Objective | Status | Tests |
| :--- | :--- | :--- | :--- | :---: | :---: |
| **ISSUE-101** | `issue-101-remove-redundant-endpoints` | `ScatterID` / Ops Dashboard | Eliminate prototype `/test_harness.html` and link directly to real production operations console (`/dashboard.html`). | **MERGED TO MAIN** | 51 passing |
| **ISSUE-102** | `issue-102-agile-policy-engine` | `ScatterID` / Policy Engine | Implement Agile Policy Engine supporting Scenario B (Tiered Risk), Scenario A (Dual-Control), Scenario C (Delegated Autonomy), and custom organization risk postures. | **MERGED TO MAIN** | 57 passing (+6) |
| **ISSUE-103** | `issue-103-portal-exhaustive-tests` | `ScatterID-app` / Help Desk Portal | Deliver full-flow test suite for all Desks: Issue Desk, 4-point checklist, scan upload SHA-256, Verify Desk, Revoke Desk, Tracking Stepper, and Clerk onboarding. | **MERGED TO MAIN** | 35 passing (+29) |
| **ISSUE-104** | `issue-104-dashboard-full-flow-tests` | `ScatterID` / Ops Dashboard | Deliver exhaustive full-flow test suite for RBAC hierarchy, managerial queues, rejection/flagging reasons, PQC key lifecycle, and backup encryption. | **MERGED TO MAIN** | 72 passing (+15) |

---

## 2. Verification & Testing Matrix

### A. ScatterID Client Portal (`ScatterID-app` on `:5000`)
- **Total Automated Tests:** 35 passing tests (`test/server.test.js`, `test/portal_full_flow.test.js`)
- **Coverage Areas:**
  1. **Issue Desk Input Boundaries:**
     - Full name validation, 1-to-250 char boundary test, XSS injection sanitization, DOB/effectiveYear formats.
     - Hard Channel 4-Point Physical Checklist (`substrate_material_integrity`, `optical_security_features`, `biometric_face_match`, `authority_seal_and_serial`). Rejects if any single checkpoint is unverified. Inspector observation field required.
     - Soft Channel Digital Scan: SHA-256 calculation (64 hex characters), tamper detection (modifying document changes digest), malformed/short hash rejection.
  2. **Verify Desk (Two-Level Verification):**
     - Level 1 Integrity: RFC 8785 canonical JSON deterministic hashing + SHA3-256.
     - Level 2 Authenticity: ML-DSA-87 (NIST FIPS 204) quantum-resistant signature verification.
     - Revocation Detection: Accurately reports Active vs. Revoked credentials with revocation docket details.
  3. **Revoke Desk:**
     - Requires Credential ID, reason selection, and mandatory docket reference. Rejects incomplete intakes.
  4. **Safe Request Tracking (FR-H6):**
     - Stepper resolution across 4 operational states: Step 1 (Intake Submitted), Step 2 (Moderation Review), Step 3 (Root Authorization), Step 4 (Ledger Committed). Zero claimant PII leaked in tracking response.
  5. **Clerk Authentication & Security:**
     - First-time setup detection (`requireFirstTimeSetup: true`), temporary token isolation, password complexity enforcement (10+ characters, upper, lower, digit, symbol), password mismatch rejection, post-onboarding session activation.

### B. ScatterID Operations Console (`ScatterID` on `:8080`)
- **Total Automated Tests:** 72 passing tests across 15 test suites
- **Coverage Areas:**
  1. **Role-Based Access Control (RBAC):**
     - Strict 401 Unauthorized for anonymous calls to all protected endpoints.
     - Strict 403 Forbidden for Clerks accessing Moderator/Root queues, policy, or key operations.
     - Strict 403 Forbidden for Moderators attempting Root-level execution, policy changes, or key cutovers.
     - Root administrator access to all queues, emergency procedures, and policy profiles.
  2. **Agile Policy & Governance Engine (DEV-ARCH-08 / ISSUE-102):**
     - `GET /api/requests/policy` & `POST /api/requests/policy` (Root-controlled).
     - **Scenario B (Tiered Risk - Default):** In-person Hard-Channel auto-executes upon Moderator approval; Soft-Channel and Revocations escalate to Root.
     - **Scenario A (Strict Dual-Control / Four-Eyes):** All issuances and revocations require Root Administrator authorization.
     - **Scenario C (Delegated Operational Autonomy):** Moderators auto-execute issuances directly to ledger; revocations remain Root-gated.
     - **Custom Client Policy:** Organizations can configure custom routing maps and checkpoint rules at runtime.
  3. **Managerial Review & Exception Queues:**
     - Moderator Approval auto-executes or escalates per active policy profile.
     - Moderator Rejection requires mandatory reason; immediately closes request with full audit attribution.
     - Moderator Flagging requires mandatory reason; moves request to `FLAGGED` queue for Root security review.
  4. **Post-Quantum Cryptography & Key Management (SEC-OPS-06):**
     - Advance Pre-Distributed PQC Key Pool: pre-staging, promotion, and retirement.
     - Emergency PQC Key Cutover: Requires explicit confirmation token `"ROTATE"`.
     - Zero-Downtime Gateway Key Rotation: 24h-48h grace period with dual-key validation.
     - AES-256-GCM Encrypted Backup Envelope (`.enc`): Passphrase-derived key wrapping, export, and authenticated atomic restoration.
  5. **System Health & Audit Attribution:**
     - Manual reconciliation probe (`POST /api/requests/reconcile`) returns `in_sync`.
     - Immutable SQLite audit log with full attribution stamps (`actor_id`, `username`, `role`, `timestamp`, `client_ip`, `details`).

---

## 3. Active Service Endpoints & Verification

| Service | Port | Endpoint Status | Primary Functions |
| :--- | :---: | :---: | :--- |
| **ScatterID Client Portal** | `5000` | **LIVE & OPERATIONAL** | Counter Clerk Help Desk, Issuance Intake, Verification, Revocation Intake, Tracking |
| **ScatterID Operations Console** | `8080` | **LIVE & OPERATIONAL** | Moderator Pending Queue, Root Authorization Queue, Flagged Queue, Key Lifecycle, Policy Engine |

### Seeded Demonstration Accounts
- **Clerk:** `clerk_john` $\rightarrow$ `TempPass-Clerk2026!`
- **Moderator:** `mod_sarah` $\rightarrow$ `TempPass-Mod2026!`
- **Root Administrator:** `root_admin` $\rightarrow$ `TempPass-Root2026!`
