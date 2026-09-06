# ScatterID Internal Ops Dashboard — UI/UX Design Doc

*Companion doc: `01-internal-dashboard-requirements-and-access.md` covers what the system must do
and who can do it. This doc covers how it looks and behaves — page by page, state by state.*

**Builder:** Appsmith (self-hosted). You are assembling from Appsmith's existing widget set
(Table, Modal, Tabs, Form, Stat/Card, Alert), not hand-designing components — the constraint here
is *composition and information hierarchy*, not visual invention.

## 1. Design Principles

- **Utilitarian, not decorative.** This is a tool security staff use daily, often under time
  pressure. Favor density and scanability over whitespace and polish.
- **The dangerous action always looks dangerous.** Anything that executes (Accept, rotation
  approve, emergency rotation) uses warning/danger color language consistently — never the same
  visual weight as a read-only action.
- **Role, not user, determines what's on screen.** A Mod and a Root looking at the same page should
  visibly see a different set of controls, not the same controls with some disabled — reinforces
  that this is a structural boundary, not a preference.
- **Every irreversible action requires a deliberate second step.** Never a single click. Escalate
  the friction with the severity: routine action → confirm modal; emergency action → confirm modal
  + typed confirmation.

## 2. Global Layout

- Left sidebar navigation, persistent: **Overview / Credentials / Moderation Queue / Key
  Rotation / Audit Log / System Health**. Items a role can't access simply don't render in the
  sidebar — not grayed out, not hidden-by-CSS, just absent, matching the structural permission
  model from the requirements doc.
- Top bar: org name (this instance's client), current user + role badge (`MOD` or `ROOT`, colored
  distinctly — see §8 palette), logout.
- Role badge is always visible in the top bar — a constant reminder of which authority level is
  active, since Mod and Root may be the same physical person on different days/instances in
  smaller orgs.

## 3. Page: Overview (home)

**Both roles**, content varies:

- Row of stat cards: *Total credentials*, *Active*, *Revoked*, *Pending Requests count*,
  reconciliation health badge (green "In sync" / amber "Drift detected").
- Root additionally sees an *Awaiting My Accept* count card, visually distinct (purple accent,
  matching the Root-tier color from the flow diagram) so it draws the eye — this is Root's actual
  queue of outstanding work, not just an FYI stat.
- Below stats: "Recent Activity" — last 10 audit log entries, compact table (timestamp, actor,
  actor role, action, result). No action buttons here — this page is orientation only.

## 4. Page: Credentials

- Full-width table: ID, status (badge: green=active, amber=pending, red=revoked), issued date,
  channel of original issuance (Hard/Soft badge).
- Search bar + status/date filter row above the table (client-side filter, instant).
- Row click → right-side detail drawer (doesn't navigate away): on-chain history timeline, current
  signing key ID, and — for Root only — a small "Related Requests" list if this credential has any
  pending/historical issue-or-revoke requests, linking into the Moderation Queue.
- No action buttons on this page for either role — this is a lookup/browse surface. All
  action happens in Moderation Queue or Key Rotation.

## 5. Page: Moderation Queue

This is the page where the two roles look most different. Built as a **tab strip**, with tabs
present/absent by role rather than disabled.

### 5.1 Tab: "Pending Requests" — Mod (primary workspace), Root (read-only)

- Table columns: Request ID, Type (Issue/Revoke), Channel badge (Hard = solid outline icon of a
  document, Soft = a scan/upload icon — pick a literal, unambiguous icon pair, not just color,
  since color alone shouldn't carry this distinction), Submitted (timestamp + which Help Desk
  desk), Claimant name.
- Row click → detail panel:
  - Claim data (name, marks/fields relevant to the credential type)
  - Proof viewer: for Soft, renders the uploaded scan/PDF inline; for Hard, shows the inspecting
    clerk's notes/checklist instead of a document viewer (there's no file — the object was
    physical), clearly labeled "Physically inspected at Help Desk — no digital copy retained"
    (or per org policy) so nobody mistakes an empty viewer for a missing upload.
  - Any automated file-anomaly notes, shown as a small "Automated notes" callout, visually
    subordinate to the human content — advisory, not a verdict (per requirements doc §4.1, this
    never gates a decision).
- Decision controls (Mod only), fixed at the bottom of the detail panel, not buried in a menu:
  - **For Hard-Channel Issue:**
    - **Approve & Auto-Execute** (solid green) — confirm modal: *"Physical document inspection checklist verified by clerk. Confirming will immediately anchor this credential on the Hyperledger Fabric ledger. Confirm?"*
    - **Reject** (red) — confirm modal with *required* reason field.
    - **Flag** (amber) — confirm modal with *required* reason field (routes to Root's Flagged queue).
  - **For Soft-Channel Issue:**
    - **Approve** (green) — confirm modal: *"This will move to Root's queue for final execution. Confirm?"*
    - **Reject** (red) — confirm modal with *required* reason field.
    - **Flag** (amber) — confirm modal with *required* reason field.
  - **For Revocations (Hard or Soft):**
    - **Approve Revocation** (amber-bordered green) — confirm modal: *"Revocations strictly require Root administrative sign-off. This will advance the revocation request to Root's Awaiting Accept queue. Confirm?"*
    - **Reject** (red) — confirm modal with *required* reason field.
    - **Flag** (amber) — confirm modal with *required* reason field.
- Root sees this same tab but with the decision controls replaced by a "View only" label — Root
  can read everything Mod can, for situational awareness, but the buttons render as informational
  status, not controls, reinforcing that this isn't Root's action to take at this stage.

### 5.2 Tab: "Awaiting My Accept" — Root only

- Shows all Soft-Channel Issues and all Revocation requests approved by Mod.
- Table columns: Request ID, Type (Issue/Revoke), Channel badge, Mod who approved, timestamp.
- Row action: **Accept** (solid green, heavier visual weight than Mod's Approve, since this is the
  actual irreversible execution) / **Reject** (red).
- Accept confirm modal states plainly what will happen: *"This will [issue / revoke] credential
  {id}. This cannot be undone. Confirm?"* — always name the specific credential, never a generic
  confirmation string, so Root can't rubber-stamp without registering what they're approving.

### 5.3 Tab: "Flagged for Review" — Root only

- Same shape as 5.2, plus Mod's flag reason shown prominently at the top of the detail panel (not
  buried below the claim data) — this is the first thing Root should read, since it's the reason
  the case escalated at all.
- Same Accept/Reject controls and confirm-modal pattern as 5.2.

## 6. Page: Key Rotation & Disaster Recovery

Tab strip:

### 6.1 Tab: "PQC Routine Rotation & Key Pool"

- **Pre-Distributed Key Pool Overview (Shared View)**:
  - Visual status stepper showing: `Active Key (v1)` $\rightarrow$ `Pre-Staged Key (v2 - Ready)` $\rightarrow$ `Pre-Staged Key (v3 - Ready)`.
  - Displays sync coverage indicator across connected/synced verifier devices (e.g. "98.4% of verifier keyrings pre-staged with v2").
- Mod view: a simple form — reason/justification text field, "Submit Rotation Request" button.
  After submit, shows a confirmation state with the request ID and "Awaiting Root approval."
- Root view: table of pending routine requests (requester, reason, timestamp). Row action:
  **Approve & Rotate to Pre-Staged Key** (green, confirm modal: *"This advances the active signing key to pre-staged key {id}. Verifiers already have this key. Confirm?"*).
- Root Action: **Pre-Generate Key Ceremony** button (mints `v_next` in advance for device pre-distribution).

### 6.2 Tab: "Emergency PQC Rotation & Delegation" — Root only

- Visually separated from the routine tab with a red-tinted panel background — this tab should
  never be visually confusable with the routine one.
- **Option A (Standard Emergency Cutover)**: Advance immediately to next pre-staged key in the pool.
- **Option B (Catastrophic: Pre-Staged Pool Compromised)**:
  - Toggle: *"Pre-staged key pool compromised — generate fresh un-staged key and sign Cryptographic Delegation Endorsement token"*.
  - System generates `v_fresh_emergency` and automatically signs a Delegation Endorsement with the current key so offline verifiers can validate it without firmware updates.
- Form: mandatory reason field, then a text input labeled "Type ROTATE to confirm" that must
  exactly match before the "Rotate Now" button becomes enabled (disabled/grayed by default). This
  extra step is deliberate friction beyond the standard confirm modal, reflecting that this path
  skips the routine request entirely.

### 6.3 Tab: "Gateway API Keys (Dual-Key Phasing)" — Root only

- Displays active gateway secrets (`REVOKE_API_KEY`, `VERIFICATION_API_KEY`).
- Table shows: Key Name, Current Active Hash/Prefix, Secondary Grace Key Hash, Grace Expiry Countdown (e.g. "Expires in 23h 45m").
- Row action: **Rotate Key** (modal prompts for Grace Window duration: 24h, 48h, or immediate; generates fresh CSPRNG secret; zero server restart).

### 6.4 Tab: "PQC Cold Backups & Disaster Recovery" — Root only

- **Export Encrypted Backup:** Root types master passphrase $\rightarrow$ downloads `scatterid_pqc_backup_<id>_<timestamp>.enc` (AES-256-GCM envelope) for offline safe/cold storage.
- **Restore from Backup:** Upload field + master passphrase input $\rightarrow$ restores keypair directly into KMS with zero historical identity invalidation.

### 6.5 Shared footer on this page (both roles)

- Current active signing key ID, and a compact rotation history table (date, triggered by whom,
  routine vs emergency) — visible to both roles as reference, no actions here.

## 7. Page: Audit Log

- Full paginated table: timestamp, actor ID, username, actor role (Clerk/Mod/Root), action type, target ID, result.
- Filter row: action type, date range, actor role, channel (Hard/Soft).
- Dedicated export button for compliance audits (CSV / JSON format).
- No row actions — this page is read-only for both roles, always.

## 8. Page: User Profile & Security Settings

**Available to both roles for self-service security management:**

- **MFA Status Card:** Shows active TOTP status and count of remaining emergency recovery codes.
- **"Transfer MFA Device (New Phone)" Button:**
  1. Opens modal requiring current account password.
  2. Renders new QR code and Base32 secret for scanning on the new phone.
  3. Input field for 6-digit TOTP code from new phone.
  4. On confirmation, revokes old device, saves new secret in SQLite, and displays 8 fresh single-use backup recovery codes.
- **Root Admin User Management (Root only):**
  - Table of all staff users (`clerks`, `mods`).
  - Row actions: "Reset Password" (issues one-time temporary password forcing change on next login), "Reset TOTP" (clears MFA so staff member can re-scan onboarding QR).

## 9. Page: System Health

- Reconciliation status card (in sync / drift detected, last run timestamp).
- "Run Reconciliation Now" button — **Root only**, standard confirm modal.

## 9. States & Edge Cases

- **Empty states:** each queue (Pending Requests, Awaiting Accept, Flagged for Review) shows a
  calm, explicit empty state ("No pending requests right now") rather than a blank table — avoids
  the ambiguity of "is this broken or just empty."
- **Loading states:** table skeleton rows on initial load; a request being submitted for decision
  shows a disabled/spinner state on the acting button so a double-click can't fire two decisions.
- **Permission error state:** if a Mod session somehow reaches a Root-only query (URL
  manipulation, stale session), show a plain, non-technical error ("You don't have permission to
  perform this action") rather than exposing the underlying API error — but still log the attempt.
- **Stale queue state:** if two Root users have the dashboard open and one Accepts a request the
  other was viewing, the second Root's view should refresh/gray out that row with "Already
  handled by {user}" rather than allowing a duplicate action attempt.

## 10. Color & Badge Palette (carried from the flow diagram, kept consistent across both docs)

| Meaning | Color |
|---|---|
| Read-only / neutral (front-desk-style boxes) | Warm gray `#F1EFE8` fill, `#5F5E5A` border |
| Standard process step | Light blue `#E6F1FB` fill, `#185FA5` border |
| Approve / success / execution-complete | Light green `#E1F5EE` fill, `#0F6E56` border |
| Reject / danger | Light red `#FCEBEB` fill, `#A32D2D` border |
| Flag / escalation | Light amber, distinct from both approve and reject — do not reuse red or
  green for Flag anywhere in the UI, since it's neither |
| Root / top-tier authority | Light purple `#EEEDFE` fill, `#534AB7` border — used for the Root
  role badge and any Root-exclusive control, so Root-only surfaces are visually identifiable at a
  glance even before reading labels |

## 11. Responsive Notes

This dashboard is an internal desk tool — optimize for desktop/laptop widths (≥1280px) as the
primary target. A reasonable tablet-width (≥768px) collapse (sidebar becomes a top dropdown,
tables gain horizontal scroll) is sufficient; there is no requirement to support phone-width
usage, unlike the Client Portal's Help Desk mode.
