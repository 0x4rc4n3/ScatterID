# ScatterID — Ops & Access Documentation Overview

This README is the index for the internal-dashboard / client-portal documentation set. Add it to
the top of `docs/` (or equivalent) so anyone new to the project has one place to start.

## What this covers

Two deployable components, each with a requirements doc and a UI/UX doc:

| Component | Requirements & Access | UI/UX Design |
|---|---|---|
| Internal Ops Dashboard | `01-internal-dashboard-requirements-and-access.md` | `02-internal-dashboard-ui-ux-design.md` |
| Client Portal & Help Desk | `03-client-portal-requirements-and-access.md` | `04-client-portal-ui-ux-design.md` |

Plus one earlier addendum still in force, referenced by both:

- `verification-channel-and-escalation-addendum.md` — defines what Hard/Soft channel means
  (physical document present vs. digital submission) and how the moderator's Approve/Reject/Flag
  interacts with it. Both dashboard docs assume this addendum, don't re-derive the definitions.

## The system in one paragraph

A credential request (issue or revoke) starts at the **Client Portal**, in **Help Desk mode**
(Issue Desk or Revoke Desk), where a clerk records the request along with which verification
channel applied — **Hard** (the physical document was inspected) or **Soft** (a digital scan was
submitted). That request lands in the **Internal Dashboard**'s Moderation Queue, where **Mod**
reviews it and decides: Approve, Reject, or Flag. Approve and Flag both route to **Root**, who is
the only role that can actually execute anything — Root's Accept is what triggers the real
issue/revoke call. Reject, at either tier, just closes the request. Key rotation follows the same
decide/execute split: Mod can only request a routine rotation, Root approves and executes it, and
Root alone has a separate emergency-rotation path for urgent cases. The Client Portal also runs a
second, unrelated mode — a public, no-login **Sandbox** for sales/technical evaluation — sharing
the same codebase but never touching the real moderation queue.

## Roles at a glance

| Role | Lives on | Can execute anything irreversible? |
|---|---|---|
| Public visitor | Client Portal (Sandbox mode) | No — preset/simulated data only |
| Help Desk clerk | Client Portal (Help Desk mode) | No — can only create requests or run a direct Verify |
| Mod | Internal Dashboard | No — decides (Approve/Reject/Flag), never executes |
| Root | Internal Dashboard | Yes — the only role that executes issue/revoke, key rotation, or emergency rotation |

## Network topology — deliberately not fixed

The Internal Dashboard is **never** internet-facing, in any configuration. The Client Portal
**might** be an org's only internet-facing surface, might sit on the same internal network as the
dashboard, or might not face the internet at all — this is an org-level decision, and both
requirements docs are written to not assume one answer. If you're deploying for a new client, that
network decision is the first thing to confirm with them, before touching either build guide.

## Where to look for what

- **"What is X allowed to do?"** → the relevant Requirements & Access doc, §3 (Roles & Access).
- **"What does the screen for X look like?"** → the relevant UI/UX doc.
- **"What happens when a hard-channel document fails inspection?"** → the verification-channel
  addendum, plus Internal Dashboard requirements doc §4.1/§5.
- **"Can we skip the Help Desk clerk for this org?"** → Client Portal requirements doc §4.3
  (`FRONT_DESK_ENABLED` / `HELP_DESK_SCOPE`).
- **"How do I build the actual pages?"** → each requirements doc's Tech Stack / Repository
  section (Appsmith for the dashboard, Flowbite for the portal); UI/UX docs give the detailed
  layout to build against.

## Change history

- v1 (original): flat admin/view-only split on the dashboard; single-mode sandbox-only portal.
- v2: introduced Mod/Root decide-vs-execute split, hard/soft channel model, and Help Desk
  operational mode on the portal. This is the current version.
