# ScatterID Internal Ops Dashboard — Requirements, Roles & Access

*Companion doc: `02-internal-dashboard-ui-ux-design.md` covers layout/visual detail. This doc
covers what the system must do and who is allowed to do it.*

## 1. Purpose & Scope

A privileged, self-hosted console deployed on the client organization's **own infrastructure**,
used by their internal staff to review issue/revoke requests, manage key rotation, and monitor
credential/audit history. One isolated instance per client org — never shared, never
cross-tenant.

**Not in scope here:** anything a credential holder or the public ever sees. That's the Client
Portal (see `03-client-portal-requirements-and-access.md`). This dashboard is internal-only,
regardless of how the org exposes its portal (see §2).

## 2. Network & Deployment Context (brief)

- The dashboard is **never internet-facing**, in any org configuration. It lives entirely inside
  the org's internal network alongside `verification-api` and `crypto-service`.
- The Client Portal *may* sit on the same internal network as this dashboard, or may be the org's
  one internet-facing surface, or may also be fully internal — this is an org-level deployment
  decision, not something this dashboard's design depends on. The dashboard's own trust boundary
  doesn't change either way: it only ever talks to `verification-api` / `crypto-service` over the
  internal network, never to the portal directly, and never to the internet.
- No component of this dashboard should ever require an outbound path to the public internet to
  function (aside from standard OS/package updates handled at the infra layer, out of scope here).

## 3. Roles & Access

Two internal roles. No anonymous or public access exists on this system at all.

| Role | Who | Core authority |
|---|---|---|
| **Mod** (moderator) | Front-line reviewer of incoming requests | Decides — Approve / Reject / Flag. Creates routine key-rotation requests. **Cannot execute anything privileged.** |
| **Root** (top admin) | Senior security/ops staff | Executes — the only role that can actually finalize issue/revoke, approve rotation, or perform emergency rotation. |

### 3.1 Permission matrix (Updated: Scenario B Tiered Risk)

| Capability | Mod | Root |
|---|:---:|:---:|
| View credential list, audit log, reconciliation status | ✅ | ✅ |
| View a credential's on-chain history & signing key | ✅ | ✅ |
| View Pending Requests (from Help Desk) | ✅ | ✅ (read-only) |
| Decide a Pending Request: Approve / Reject / Flag | ✅ | ❌ |
| Auto-execute Hard-Channel Issuance upon explicit Approve | ✅ (Policy Auto-Fire) | ❌ |
| View Awaiting Accept queue (Soft Issue & all Revocations) | ❌ | ✅ |
| View Flagged for Review queue | ❌ | ✅ |
| Accept a request from Root queue (executes issue/revoke) | ❌ | ✅ |
| Reject a request from Root's queues (closes, no execution) | ❌ | ✅ |
| Create a routine key-rotation request | ✅ | ❌ |
| Approve a routine rotation request (executes rotation) | ❌ | ✅ |
| Perform emergency key rotation (bypasses routine request) | ❌ | ✅ |
| Rotate Gateway API keys (Dual-key zero-downtime phasing) | ❌ | ✅ |
| Export / Restore Encrypted PQC Key Envelope (`.enc`) | ❌ | ✅ |
| Manually trigger reconciliation run | ❌ | ✅ |
| Self-service Transfer MFA Device (TOTP migration) | ✅ | ✅ |
| Reset Clerk password / Re-issue Clerk TOTP | ✅ | ✅ |
| Reset Mod password / Re-issue Mod TOTP | ❌ | ✅ |

Enforcement must happen at the query/datasource permission layer, not by hiding UI elements —
a Mod session hitting a Root-only action directly (URL manipulation, direct API call) must get a
real permission error. See the UI/UX doc §7 for how this is presented, and the acceptance
criteria in §8 below for how it's tested.

### 3.2 Why Mod can't execute destructive actions

Structural decision, not a UI restriction: Mod's session has **no credential** capable of
calling destructive execution endpoints (Revocation, Key Rotation, or Soft-Channel Issuance).
Root is the sole entity holding execution-capable credentials for irreversible administrative operations.

For Hard-Channel Issuance, auto-execution is handled entirely by backend policy: Mod does not hold
the underlying signing key directly; instead, Mod's cryptographic approval signature triggers
the backend orchestrator to issue the proof if and only if the request originated from a physical
in-person inspection checklist.

## 4. Features / Functional Requirements

| ID | Requirement | Role |
|---|---|---|
| FR-1 | View list of all issued credentials with status | Mod, Root |
| FR-2 | Search/filter credential list by ID, status, date | Mod, Root |
| FR-3 | View audit log with full staff actor attribution (`actor_id`, `username`, `role`, `channel`) | Mod, Root |
| FR-4 | View ledger reconciliation health | Mod, Root |
| FR-5 | Manually trigger a reconciliation run | Root |
| FR-6 | View full on-chain history for a credential | Mod, Root |
| FR-9 | View active signing key ID and rotation history | Mod, Root |
| FR-10 | View Pending Requests forwarded from Help Desk, with hard/soft channel badge, claim data, proof | Mod (act), Root (view) |
| FR-11 | Decide a Pending Request: Approve / Reject / Flag, with required reason on Reject/Flag | Mod |
| FR-11B| **Tiered Auto-Execution:** Hard-Channel Issue requests auto-execute on explicit Mod Approve | System (via Mod trigger) |
| FR-12 | View Awaiting Accept queue (Soft-Channel Issue & all Revocations awaiting Root execution) | Root |
| FR-13 | View Flagged for Review queue (Mod-flagged, with Mod's reason shown) | Root |
| FR-14 | Accept a request from either queue — executes issue/revoke | Root |
| FR-15 | Reject a request from either queue — closes without executing | Root |
| FR-16 | Create a routine key-rotation request | Mod |
| FR-17 | Approve a routine rotation request — executes rotation | Root |
| FR-18 | Emergency key rotation — bypasses routine request, mandatory reason field | Root |
| FR-19 | Rotate Gateway Keys (`REVOKE_API_KEY`) with 24-48h dual-key grace window | Root |
| FR-20 | Export/Restore AES-256-GCM encrypted PQC key backup envelopes (`.enc`) | Root |
| FR-21 | Self-service MFA re-enrollment & device transfer (buying a new phone) | Mod, Root |
| FR-22 | Reset subordinate staff account passwords & TOTP seeds | Mod (Clerks), Root (All) |
| FR-23 | Manage Pre-Distributed PQC Key Pool (advance generation & verifier pre-staging) | Root |
| FR-24 | Generate Cryptographic Delegation Endorsement Token (fallback when pre-staged pool compromised) | Root |

### 4.1 Hard/soft channel — what it means here

- **Hard** = the original physical document was physically inspected in-person by a Help Desk clerk. No digital scan is retained for privacy; the clerk completes an inspection checklist.
- **Soft** = a digital submission (scan/photo/PDF) was submitted and requires digital proof inspection.
- The channel is shown as context on every Pending Request and controls the execution tier.

## 5. How It Works — Request Lifecycle (Scenario B: Tiered Risk)

1. Help Desk (Issue Desk or Revoke Desk) submits a request with proof and channel type $\rightarrow$ lands in this dashboard's **Pending Requests** queue.
2. Mod reviews it (FR-11), sees the channel badge and proof, and decides:
   - **Case A: Hard-Channel Issue $\rightarrow$ Approve**:
     - System **auto-executes** issuance immediately on the Hyperledger Fabric ledger.
     - Credential status updates to `anchored`.
     - Logged with dual attribution: Mod's username + auto-execution policy.
   - **Case B: Soft-Channel Issue $\rightarrow$ Approve**:
     - Moves to Root's **Awaiting Accept** queue. Nothing executes yet.
   - **Case C: Revoke Request (Hard or Soft) $\rightarrow$ Approve**:
     - **STRICTLY MANDATORY ROOT EXECUTION**: Moves to Root's **Awaiting Accept** queue. Revocations never auto-execute under any circumstances.
   - **Case D: Reject**:
     - Closed immediately. Mod's reason recorded. Ends here — zero Root involvement needed.
   - **Case E: Flag**:
     - Moves to Root's **Flagged for Review** queue, with Mod's stated reason attached.
3. Root reviews Awaiting Accept / Flagged for Review:
   - **Accept** $\rightarrow$ executes the actual issue/revoke call against `verification-api`. Logged.
   - **Reject** $\rightarrow$ closes without executing. Logged.
4. Key rotation follows the same decide/execute split: Mod creates a routine request (FR-16); Root approves it, calling `/rotate` (FR-17). Root also has a separate emergency rotation path (FR-18).
5. For recovery and key lifecycle, Root manages dual-key rotation (FR-19) and encrypted PQC backups (FR-20).

Every step writes its own distinct, separately-attributed entry to the audit log with `staff_user_id`, `username`, `role`, and `channel`.

## 6. Non-Functional Requirements

- **NFR-1 — Isolation:** one instance per client org, no cross-tenant data path.
- **NFR-2 — Privilege separation is structural:** Mod's session has zero reach into destructive execution-capable endpoints.
- **NFR-3 — Self-hosted, Docker-native:** deploys as an internal compose service without external SaaS dependencies.
- **NFR-4 — TLS trust:** correctly trusts the internal CA used by `crypto-service`'s self-signed cert.
- **NFR-5 — Auditability & Attribution:** every action records actor identity, role, channel, and timestamp.
- **NFR-6 — Mandatory MFA:** TOTP (RFC 6238) enforced for all Mod and Root accounts.
- **NFR-7 — Network Microsegmentation:** Dashboard is strictly isolated from the general Help Desk VPN subnet; accessible only from the management subnet / on-prem LAN (see `07-network-topology-and-segmentation.md`).
- **NFR-8 — Disaster Recovery:** Full recovery pathways documented in `06-disaster-recovery-and-key-lifecycle.md` (break-glass CLI, phone transfers, dual-key grace periods, encrypted PQC snapshots).

## 7. Repository & Branching

- **Repo:** `ScatterID` (core repo).
- **Directory:** `components/ops-dashboard/`
- **Branch:** `feat/ops-dashboard`

## 8. Acceptance Criteria

- [ ] Mod can see all read-only pages and the Pending Requests queue; cannot directly execute destructive actions.
- [ ] Hard-Channel Issue requests auto-execute on explicit Mod Approve; Soft-Channel Issue requests strictly require Root Accept.
- [ ] Revocations strictly require Root Accept regardless of channel; auto-execution on revocation is impossible.
- [ ] Root's Accept, rotation approve, and emergency rotation each require confirmation modals.
- [ ] Emergency rotation requires a typed confirmation (`ROTATE`) and mandatory justification reason.
- [ ] Multi-Factor Authentication (TOTP) is enforced at login for Mod and Root.
- [ ] Self-service MFA transfer allows administrators to enroll a new phone without downtime or server shell access.
- [ ] Help Desk VPN users are firewalled from reaching the Ops Dashboard port (:8080).
- [ ] Dual-key rotation allows rotating gateway keys with a 24-48h overlap grace period without container restarts.
- [ ] Catastrophic recovery via offline CLI (`tools/admin_cli.js breakglass`) successfully resets Root in an air-gapped host environment.
