# ScatterID Client Portal & Help Desk — UI/UX Design Doc

*Companion doc: `03-client-portal-requirements-and-access.md` covers what the system must do and
who can do it. This doc covers how it looks and behaves.*

**Builder:** Flowbite (Tailwind-based component library), no build step required — assemble from
existing tabs/cards/badges/alerts/modals rather than hand-designing.

## 1. Design Principles

- **Two audiences, two visual registers, one codebase.** Sandbox mode should feel like a polished
  sales/marketing surface — confident, a little bit "look how real this is." Help Desk mode should
  feel like a plain operational form — fast, low-friction, no marketing copy, nothing to admire.
  Don't let Sandbox's visual flourish leak into Help Desk screens or vice versa.
- **Mode must be unmistakable at a glance.** Someone glancing at a screen over a clerk's shoulder,
  or a clerk glancing at their own screen after a context switch, should instantly know whether
  they're looking at Sandbox or Help Desk — never rely on reading text to tell them apart.
- **Real numbers, not placeholders.** Sandbox mode's whole trust-building job depends on this
  (unchanged from original doc). Help Desk mode's equivalent is real request IDs and real status
  transitions — no "Lorem ipsum"-style placeholder states anywhere a clerk will actually use it.

## 2. Mode Distinction (the most important visual decision in this doc)

- **Persistent top banner**, different per mode, never absent:
  - Sandbox: light, marketing-toned banner — *"You're in the public sandbox — sample data only,
    not a production identity service."* (satisfies FR-8) Light background, friendly icon.
  - Help Desk: solid, high-contrast banner — *"Help Desk — [Clerk name] — [Issue / Verify / Revoke]
    Desk"* with a small live/authenticated indicator. Darker, more "operational console" tone,
    never using the same background color as the Sandbox banner.
- **Separate entry URLs/routes** (`/sandbox` vs `/helpdesk`) even though it's one codebase — a
  clerk should never land on Help Desk mode by following a Sandbox link, or vice versa.
- **No shared visual chrome beyond the base Flowbite theme** — logo placement, banner, and primary
  action button color should differ enough between modes that a screenshot alone tells you which
  one you're looking at.

## 3. Sandbox Mode — Page Structure (unchanged core, reference only)

Same three-tab Flowbite Tabs layout as the original design (Holder Studio / Verifier Portal /
Tamper Simulator) — see original build guide §6.2–6.4 for the base component code, which is
unchanged. Recap of the key UX beat that must survive any restyling:

- **Holder Studio:** preset selector → live canonical JSON preview → Issue button → credential
  card with real hash/signature/key ID.
- **Verifier Portal:** paste/upload → Verify → Level 1 (hash) and Level 2 (signature) results
  shown as **two separate badges**, never collapsed into one boolean — this separation is itself
  part of the credibility story.
- **Tamper Simulator:** flip-a-byte button → re-verify → an unambiguous, visually loud REJECTED
  state (red, full-width badge, not a small inline label) — test this specific moment with a
  non-technical person; if they don't immediately register failure, it's not loud enough yet.
- Sandbox disclaimer (FR-8) must be visible without scrolling on page load, on every sandbox page,
  not just the landing tab.

## 4. Help Desk Mode — Page Structure (new)

Login screen (plain, Flowbite form component, no marketing content) → lands on the desk(s) the
account is scoped to (per `HELP_DESK_SCOPE`, see requirements doc §3.1). If scoped to `all`, show
a tab strip identical in mechanism to Sandbox's (same Flowbite Tabs component, different content
and tone) for **Issue Desk / Verify Desk / Revoke Desk**.

### 4.1 Issue Desk

- Claimant data form (name, marks/fields relevant to the credential type — same field set the org
  configured for the credential type).
- **Channel selector**, prominent, above the fold: two large radio-style cards, not a small
  dropdown — this decision matters enough to deserve visual weight:
  - "Hard — physical document present" (icon: physical document/seal)
  - "Soft — digital submission" (icon: upload/scan)
- If Hard selected: no file upload shown; instead a short checklist/notes field for the clerk to
  record what they physically inspected (matches the internal dashboard's "physically inspected"
  panel on the other end).
- If Soft selected: file upload widget (drag-and-drop + browse), accepted formats shown explicitly
  (PDF/JPG/PNG), file preview thumbnail after upload.
- Submit → confirmation screen: request ID (large, copyable), plain-language next step ("Sent for
  moderator review — you can check its status anytime with this ID"). No jargon about queues or
  internal roles.

### 4.2 Verify Desk

- Same visual shape as Sandbox's Verifier Portal (paste/upload → Verify → two-badge result) but
  **restyled in Help Desk's operational tone** (see §2) and hitting the real gateway. Add a small,
  permanent label distinguishing this from Sandbox's tamper-testing framing — this screen is a
  real check with real consequences, not a demo of what happens when something's wrong.
- No Tamper Simulator equivalent here — flipping bytes on a real credential has no operational
  purpose at the Help Desk.

### 4.3 Revoke Desk

- Same shape as Issue Desk: claimant/credential lookup field, reason field, same channel-selector
  pattern (Hard/Soft), same confirmation-screen-with-request-ID pattern on submit.
- Because revoke is more consequential than issue from the requester's perspective, add one extra
  confirmation step before submit: a plain summary ("You are requesting revocation of credential
  {id} for reason: {reason}. Submit for review?") — this is still just creating a request, not an
  execution, so it's a lighter confirmation than anything on the Internal Dashboard, but still
  more than a bare submit button.

### 4.4 Request Status Lookup (shared, Issue + Revoke)

- Simple search-by-ID field, accessible from a persistent link in the Help Desk banner.
- Result shows a status stepper (Submitted → Under Review → [Executed | Rejected]), not internal
  detail — no visibility into Mod's or Root's reasoning, channel evidence, or flag status. Keep
  this deliberately minimal; anything more belongs on the Internal Dashboard, not here.

## 5. Component Notes

- **Channel selector cards** (§4.1): use Flowbite's card component with a radio input bound to
  each card's click target (not just the tiny radio dot) — on a tablet at an intake counter, the
  whole card should be tappable.
- **Confirmation screens** (post-submit, both desks): use Flowbite's Alert component in its
  "success" variant, plus the request ID rendered in a monospace, copyable code block — matches
  the "show real values" principle from NFR-2.
- **Status stepper**: a simple horizontal Flowbite stepper/breadcrumb pattern; use only the
  neutral/blue/green/red palette already established for the Internal Dashboard (§10 of that
  doc) so a request's visual state language is consistent across both surfaces even though clerks
  never see the dashboard itself.

## 6. States & Edge Cases

- **Upload failure (Soft channel):** clear inline error under the upload widget, never a modal
  that interrupts the flow — the clerk is often mid-conversation with a requester.
- **Session timeout (Help Desk):** redirect to login with the in-progress form data preserved in
  browser memory (not submitted, not lost) and a visible "Your session expired — please log back
  in to continue" message, so a clerk mid-intake doesn't lose a requester's data.
- **Gateway unreachable:** Help Desk desks show a plain "Verification service is currently
  unavailable — please try again shortly" state rather than a raw error; Sandbox mode should never
  show this at all, since it must work standalone even if the real gateway is down (per NFR-3 in
  the requirements doc).
- **`FRONT_DESK_ENABLED=false`:** Issue/Revoke Desk forms render for the requester directly with
  the same layout — just without the clerk-facing banner/login wrapper. Same components, different
  access wrapper.

## 7. Responsive Notes

- **Sandbox mode:** must work well down to 375px (prospects opening a link on a phone after a
  sales call) — stack the tab content vertically, keep the canonical-JSON and tamper-simulator
  code blocks horizontally scrollable rather than shrinking font size illegibly.
- **Help Desk mode:** primary target is tablet width (≥768px, an intake counter device) with phone
  width (375px) as a secondary/acceptable fallback, not a design priority — channel-selector cards
  in particular should stack to full-width single-column below 480px.
