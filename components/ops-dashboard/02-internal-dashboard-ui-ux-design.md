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
  - **Approve** (green) — single confirm modal: "This will move to Root's queue for final
    execution. Confirm?"
  - **Reject** (red) — confirm modal with a *required* reason text field.
  - **Flag** (amber, visually distinct from both — this is escalation, not agreement or
    disagreement) — confirm modal with a *required* reason text field.
- Root sees this same tab but with the decision controls replaced by a "View only" label — Root
  can read everything Mod can, for situational awareness, but the buttons render as informational
  status, not controls, reinforcing that this isn't Root's action to take at this stage.

### 5.2 Tab: "Awaiting My Accept" — Root only

- Same table shape as above, plus a "Mod decision" column showing who approved it and when.
- Row action: **Accept** (solid green, heavier visual weight than Mod's Approve, since this is the
  actual execution) / **Reject** (red).
- Accept confirm modal states plainly what will happen: *"This will [issue / revoke] credential
  {id}. This cannot be undone. Confirm?"* — always name the specific credential, never a generic
  confirmation string, so Root can't rubber-stamp without registering what they're approving.

### 5.3 Tab: "Flagged for Review" — Root only

- Same shape as 5.2, plus Mod's flag reason shown prominently at the top of the detail panel (not
  buried below the claim data) — this is the first thing Root should read, since it's the reason
  the case escalated at all.
- Same Accept/Reject controls and confirm-modal pattern as 5.2.

## 6. Page: Key Rotation

Tab strip again:

### 6.1 Tab: "Routine Request"

- Mod view: a simple form — reason/justification text field, "Submit Rotation Request" button.
  After submit, shows a confirmation state with the request ID and "Awaiting Root approval."
- Root view: table of pending routine requests (requester, reason, timestamp). Row action:
  **Approve & Rotate** (green, confirm modal: *"This rotates the active signing key. All future
  issuance will use the new key. This cannot be undone. Confirm?"*).

### 6.2 Tab: "Emergency Rotation" — Root only

- Visually separated from the routine tab with a red-tinted panel background — this tab should
  never be visually confusable with the routine one.
- Form: mandatory reason field, then a text input labeled "Type ROTATE to confirm" that must
  exactly match before the "Rotate Now" button becomes enabled (disabled/grayed by default). This
  extra step is deliberate friction beyond the standard confirm modal, reflecting that this path
  skips the routine request entirely.

### 6.3 Shared footer on this page (both roles)

- Current active signing key ID, and a compact rotation history table (date, triggered by whom,
  routine vs emergency) — visible to both roles as reference, no actions here.

## 7. Page: Audit Log

- Full paginated table: timestamp, actor, actor role (Mod/Root — new column vs v1), action type,
  target, result.
- Filter row: action type, date range, actor role. The actor-role filter is new and important here
  — since a single request now generates a Mod-decision entry and a separate Root-execution entry,
  staff need to be able to isolate "show me only executions" or "show me only decisions" when
  auditing.
- No row actions — this page is read-only for both roles, always.

## 8. Page: System Health

- Reconciliation status card (in sync / drift detected, last run timestamp).
- "Run Reconciliation Now" button — **Root only**, standard confirm modal (not the heavier typed
  pattern; this action is non-destructive, just re-checks state).

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
