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

### 3.1 Permission matrix

| Capability | Mod | Root |
|---|:---:|:---:|
| View credential list, audit log, reconciliation status | ✅ | ✅ |
| View a credential's on-chain history & signing key | ✅ | ✅ |
| View Pending Requests (from Help Desk) | ✅ | ✅ (read-only) |
| Decide a Pending Request: Approve / Reject / Flag | ✅ | ❌ |
| View Awaiting Accept queue | ❌ | ✅ |
| View Flagged for Review queue | ❌ | ✅ |
| Accept a request (executes issue/revoke) | ❌ | ✅ |
| Reject a request from Root's queues (closes, no execution) | ❌ | ✅ |
| Create a routine key-rotation request | ✅ | ❌ |
| Approve a routine rotation request (executes rotation) | ❌ | ✅ |
| Perform emergency key rotation (bypasses routine request) | ❌ | ✅ |
| Manually trigger reconciliation run | ❌ | ✅ |

Enforcement must happen at the query/datasource permission layer, not by hiding UI elements —
a Mod session hitting a Root-only action directly (URL manipulation, direct API call) must get a
real permission error. See the UI/UX doc §7 for how this is presented, and the acceptance
criteria in §8 below for how it's tested.

### 3.2 Why Mod can't execute anything

Structural decision, not a UI restriction: Mod's session should have **no credential** capable of
calling the privileged issue/revoke or rotation endpoints — not held, not reachable, not just
hidden behind a permission check that could be misconfigured. Mod physically cannot cause an
irreversible action even if every button were exposed to them. Root is the only role holding
execution-capable credentials.

## 4. Features / Functional Requirements

| ID | Requirement | Role |
|---|---|---|
| FR-1 | View list of all issued credentials with status | Mod, Root |
| FR-2 | Search/filter credential list by ID, status, date | Mod, Root |
| FR-3 | View audit log | Mod, Root |
| FR-4 | View ledger reconciliation health | Mod, Root |
| FR-5 | Manually trigger a reconciliation run | Root |
| FR-6 | View full on-chain history for a credential | Mod, Root |
| FR-9 | View active signing key ID and rotation history | Mod, Root |
| FR-10 | View Pending Requests forwarded from Help Desk, with hard/soft channel badge, claim data, proof | Mod (act), Root (view) |
| FR-11 | Decide a Pending Request: Approve / Reject / Flag, with required reason on Reject/Flag | Mod |
| FR-12 | View Awaiting Accept queue (Mod-approved, not yet executed) | Root |
| FR-13 | View Flagged for Review queue (Mod-flagged, with Mod's reason shown) | Root |
| FR-14 | Accept a request from either queue — executes issue/revoke | Root |
| FR-15 | Reject a request from either queue — closes without executing | Root |
| FR-16 | Create a routine key-rotation request | Mod |
| FR-17 | Approve a routine rotation request — executes rotation | Root |
| FR-18 | Emergency key rotation — bypasses routine request, mandatory reason field | Root |

### 4.1 Hard/soft channel — what it means here

- **Hard** = the original physical document was physically inspected (in person, or handed off via
  Help Desk's Issue/Revoke desk).
- **Soft** = a digital submission (scan/photo) was inspected instead.
- The channel is shown as context on every Pending Request — it never gates which of
  Approve/Reject/Flag Mod can use. It only informs how confident Mod can reasonably be. See §5 of
  the verification-channel addendum for the full reasoning.

## 5. How It Works — Request Lifecycle

1. Help Desk (Issue Desk or Revoke Desk, see Client Portal doc) submits a request with proof and
   channel type → lands in this dashboard's **Pending Requests** queue.
2. Mod reviews it (FR-11), sees the channel badge and proof, and:
   - **Approve** → moves to Root's **Awaiting Accept** queue. Nothing has executed yet.
   - **Reject** → closed immediately. Logged. Ends here — no Root involvement needed.
   - **Flag** → moves to Root's **Flagged for Review** queue, with Mod's stated reason attached.
3. Root reviews Awaiting Accept / Flagged for Review and:
   - **Accept** → executes the actual issue/revoke call. Logged.
   - **Reject** → closes without executing. Logged.
4. Key rotation follows the same decide/execute split: Mod creates a **routine** request (FR-16);
   Root approves it, which is what actually calls `/rotate` (FR-17). Root also has a separate
   **emergency rotation** path (FR-18) that skips the routine request entirely, for cases like
   suspected key compromise — gated behind a stronger confirmation than the routine path (see
   UI/UX doc).

Every step — Mod's decision and Root's execution — writes its own distinct, separately-attributed
entry to the audit log. A Mod decision and a later Root execution on the same request are never
merged into one entry.

## 6. Non-Functional Requirements

- **NFR-1 — Isolation:** one instance per client org, no cross-tenant data path.
- **NFR-2 — Privilege separation is structural:** see §3.2. Mod's datasource/credentials must have
  zero reach into execution-capable endpoints.
- **NFR-3 — Self-hosted, Docker-native:** deploys the same way as every other ScatterID service —
  a `docker-compose` service, no external SaaS dependency to run it.
- **NFR-4 — TLS trust:** must correctly trust the internal CA used by `crypto-service`'s
  self-signed cert. Known early blocker — budget time for it.
- **NFR-5 — Auditability:** every action (Mod decision, Root execution, reconciliation run) must
  land in the audit log via the normal API call, never bypassed.

## 7. Repository & Branching

- **Repo:** `ScatterID` (core repo).
- **Directory:** `components/ops-dashboard/`
- **Branch:** `component/dashboard`

## 8. Acceptance Criteria

- [ ] Mod can see all read-only pages and the Pending Requests queue; cannot see or execute
      Accept/Reject/rotation-approve/emergency-rotation actions, including via direct URL/API call
      (tested explicitly, not just via hidden buttons).
- [ ] Mod's Approve never touches an execution-capable credential — confirmed by inspecting the
      actual call, not just observed UI behavior.
- [ ] Root's Accept, rotation approve, and emergency rotation each require confirmation;
      emergency rotation additionally requires a reason and a stronger (typed) confirmation.
- [ ] A Mod decision and the corresponding later Root execution appear as two distinct,
      separately-attributed entries in the audit log.
- [ ] Hard/soft channel badge is visible and correct on every Pending Request, and carries through
      to the Awaiting Accept / Flagged for Review queues.
- [ ] Reconciliation run and every privileged action are confirmed present in the audit log
      afterward — checked manually, not assumed from a successful API response.
