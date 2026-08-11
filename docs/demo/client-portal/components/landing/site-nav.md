# Component Technical Specification: site-nav.tsx

## 1. Purpose & Core Responsibility
- Renders the primary navigation header for the ScatterID landing page, sized to exactly `5vh` height.
- Handles smooth scroll redirection and dynamically identifies the currently active section based on the scroll snap position.

## 2. Inbound & Outbound Communication Whitelist
- **Allowed Inbound (Who can talk TO this file):** 
  - `Hero` component inside `hero.tsx` (where it is rendered at the top of Section 0).
- **Explicitly Denied Inbound:** 
  - No external services, routes, or network nodes can directly call this file.
- **Allowed Outbound (Who this file can talk TO):** 
  - DOM scroll interfaces (`targetEl.scrollIntoView`) for snap point transitions.
  - Firebase Authentication status state helpers (`initAuth`, `auth`).
- **Explicitly Denied Outbound:** 
  - No other outbound API calls or connections are permitted.

## 3. Function & Method Manifest
- **`SiteNav()`**
  - **Purpose:** Primary navigation header element of height `5vh`.
  - **Inputs & Sanitization:** None.
  - **Outputs:** Interactive navigation menu structure with desktop and mobile responsive drawers.
  - **Error States & Handling:** Safe DOM query checks to bypass calculations when the target container elements cannot be resolved.

- **`handleNavClick(e, href)`**
  - **Purpose:** Captures navigation links and triggers browser scroll snap.
  - **Inputs:** `e` (React MouseEvent), `href` (target anchor string).
  - **Outputs:** Smooth scrolls to the target anchor element.

## 4. Security & Compliance Posture
- Restricts user access patterns via client-side routing.
- Integrates with the Firebase authentication runtime instance in a read-only manner.
