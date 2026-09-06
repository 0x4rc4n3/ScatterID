# ScatterID Client Portal & Help Desk — Requirements, Roles & Access

*Companion doc: `04-client-portal-ui-ux-design.md` covers layout/visual detail. This doc covers
what the system must do and who is allowed to do it.*

## 1. Purpose & Scope — this is now two things in one deployable

This portal serves **two distinct purposes**, switched by mode, not by rebuilding:

- **Sandbox/Demo mode** — the original purpose: a public, no-login sales/evaluation tool letting a
  prospect experience issue → verify → tamper → rejected using preset data, no real submissions,
  no moderation queue involved.
- **Help Desk (operational) mode** — new: the actual front-line staff tool. Authenticated Help
  Desk clerks use it to submit real issue/revoke requests (which land in the Internal Dashboard's
  Moderation Queue — see the internal-dashboard requirements doc) and to perform real, immediate
  verification.

Same codebase, same `GATEWAY_URL` dual-mode design already anticipated in the original build —
Sandbox mode runs client-side/simulated or against preset data; Help Desk mode requires auth and
talks to the real Verification Gateway.

## 2. Network & Deployment Context (brief) — org-dependent, plan for both

- **This portal may be the org's only internet-facing surface**, if the org wants prospects to
  reach the Sandbox and/or wants remote Help Desk access. In that configuration, Sandbox and Help
  Desk modes are served from the same public-facing instance, distinguished entirely by
  authentication — Sandbox requires none, Help Desk mode requires a valid staff login and is not
  discoverable/usable without one.
- **Alternatively, some orgs keep everything internal** — no public Sandbox at all, and Help Desk
  runs on the same internal network as the Internal Dashboard, reachable only from inside the
  org's network (VPN/intranet). In that setup, this codebase is deployed twice if needed (a
  public marketing-only sandbox instance with `GATEWAY_URL` unset, and a separate internal Help
  Desk instance with `GATEWAY_URL` set) — or once, gated by network ACLs, per org preference.
- **Design accordingly:** never assume the internet-facing boundary sits in a fixed place. The one
  invariant is that Sandbox mode must never be able to write anything into the real moderation
  queue, and Help Desk mode must never be reachable without authentication, regardless of which
  network topology an org chooses.

## 3. Roles & Access

| Role | Auth required | What they can do |
|---|---|---|
| **Public visitor** (Sandbox mode) | None | Holder Studio, Verifier Portal, Tamper Simulator — all against preset/simulated data only |
| **Help Desk clerk** | Yes — staff login | Issue Desk, Verify Desk, Revoke Desk — real submissions/verification against the live Verification Gateway |

There is no role above Help Desk clerk on this portal — Mod and Root exist only on the Internal
Dashboard. A Help Desk clerk **cannot** see the moderation queue, cannot approve/reject/flag
anything, and gets no visibility into what happens to a request after submission beyond a
tracking/status lookup (§5.3).

### 3.1 Help Desk sub-access

Whether a single clerk account can use all three desks (Issue/Verify/Revoke) or accounts are
scoped to one desk each is an **org-level configuration choice**:

| ID | Requirement |
|---|---|
| FR-C4 | Config flag `HELP_DESK_SCOPE` = `all` (any authenticated Help Desk user sees all three desks) or `per-desk` (user's account is scoped to exactly one of Issue/Verify/Revoke) |

Default to `all` for smaller orgs; `per-desk` is there for orgs that want stricter separation of
duties even at the intake level (e.g. the person who verifies shouldn't also be the person who
intakes revoke requests).

## 4. Features / Functional Requirements

### 4.1 Sandbox mode (unchanged from original scope)

| ID | Requirement | Notes |
|---|---|---|
| FR-1 | Holder Studio: pick a credential preset | Preset data only, never real PII |
| FR-2 | Show RFC 8785 canonicalized JSON live, before issuance | Transparency moment |
| FR-3 | Generate a CSPRNG salt client-side, shown explicitly | Zero-knowledge story |
| FR-4 | Issue button → returns full credential (hash, signature, key ID) | Proxies to Verification Gateway or simulated |
| FR-5 | Verifier Portal: paste/upload credential JSON, Verify | Shows Level 1 (hash) and Level 2 (signature) separately |
| FR-6 | Tamper Simulator: flip a byte, re-verify, see REJECTED | The trust-building moment |
| FR-7 | Copyable/downloadable credential JSON | Devs inspect the raw shape |
| FR-8 | Visible "this is a public demo/sandbox" notice | Sets expectations |

### 4.2 Help Desk mode (new)

| ID | Requirement | Which desk | Notes |
|---|---|---|---|
| FR-H1 | Login required before any Help Desk desk is reachable | All | Session-based; Sandbox remains reachable without login regardless |
| FR-H2 | Issue Desk: collect claimant data + choose channel (Hard/Soft) | Issue | Hard = mark "physical document inspected," no file needed; Soft = upload scan/PDF |
| FR-H3 | Issue Desk: submit → creates a Pending Request in the Internal Dashboard's Moderation Queue | Issue | Not executed here — this only creates the request; see internal-dashboard doc |
| FR-H4 | Verify Desk: paste/upload credential, verify immediately, real (non-simulated) result | Verify | This is non-privileged — no moderation queue involved, matches "Direct verify" in the original flow |
| FR-H5 | Revoke Desk: collect reason + channel (Hard/Soft), submit → creates a Pending Request | Revoke | Same channel model as Issue Desk |
| FR-H6 | Request tracking lookup: clerk can check status of a request they submitted (Pending / Awaiting Accept / Flagged / Executed / Rejected) by request ID | Issue, Revoke | Status only — no detail on Mod's/Root's reasoning is shown here, that stays internal |
| FR-H7 | Front-desk-skip config, per the verification-channel addendum | Issue, Revoke | `FRONT_DESK_ENABLED` toggle (see §4.3) |

### 4.3 Config: skipping the clerk entirely

Per the verification-channel addendum (§2, FR-C1–C3): some orgs may not want a Help Desk clerk as
an intake layer at all, letting requesters submit directly.

| ID | Requirement |
|---|---|
| FR-C1 | `FRONT_DESK_ENABLED` (true/false), read at deploy/runtime |
| FR-C2 | When `true`, Help Desk clerk intake applies uniformly to Issue and Revoke (not Verify, which has no intake step regardless) |
| FR-C3 | Channel type (Hard/Soft) is always recorded on the request, whichever intake path was used |

When `FRONT_DESK_ENABLED=false`, the Issue/Revoke desks are presented directly to the requester
(still gated by whatever auth model the org wants for *requesters*, which is separate from Help
Desk staff auth — out of scope for this doc, org-specific).

## 5. Non-Functional Requirements

- **NFR-1 — No design skill required to build this:** assemble from Flowbite's component library,
  don't hand-invent layout (see UI/UX doc).
- **NFR-2 — Must feel like real cryptography, not a mock:** real hex values, byte counts, hash
  outputs in Sandbox mode; real request IDs and real status transitions in Help Desk mode.
- **NFR-3 — Dual-mode by design:** Sandbox must work fully standalone/simulated; Help Desk mode
  requires `GATEWAY_URL` and real auth. Never let a misconfiguration allow Sandbox-mode traffic to
  reach the real moderation queue, or Help Desk mode to run without authentication.
- **NFR-4 — Mobile-reasonable:** Sandbox for prospects on a phone after a sales call; Help Desk
  mode for a clerk who may be on a tablet at an intake counter. Both need to work at ≥375px width
  (see UI/UX doc §7).
- **NFR-5 — Strict mode isolation:** Sandbox and Help Desk mode must be trivially distinguishable
  to the person using them at all times (see UI/UX doc §2) — nobody should be able to mistake a
  real submission screen for the sandbox, or vice versa.

## 6. Repository & Branching

- **Repo:** `ScatterID-app`
- **Branch:** `app/main-work`
- **Directory:** `public/`
- Backend (`server.js`) stays as-is for Sandbox mode logic; Help Desk mode adds new endpoints
  (`/api/requests`, `/api/requests/:id/status`, auth middleware) but reuses the same canonicalization
  and proxying logic already in place.

## 7. Acceptance Criteria

- [ ] Sandbox mode is reachable with no login and never writes to the real moderation queue, in
      any deployment/network configuration.
- [ ] Help Desk mode is unreachable without a valid staff login, in any deployment/network
      configuration — including when this portal is the org's sole internet-facing surface.
- [ ] Issue Desk and Revoke Desk both record channel type (Hard/Soft) on every submission.
- [ ] A submission from Issue/Revoke Desk appears in the Internal Dashboard's Pending Requests
      queue within an acceptable delay (define SLA per org; verify manually, don't assume).
- [ ] Verify Desk returns a real result against the live gateway, distinguishable from Sandbox's
      Tamper Simulator both functionally and visually.
- [ ] `FRONT_DESK_ENABLED` and `HELP_DESK_SCOPE` are both read from config at runtime, not
      hardcoded per deployment.
- [ ] Mobile viewport tested at minimum 375px width for both modes.
