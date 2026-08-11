# Component Technical Specification: global-scroll-arrows.tsx

## 1. Purpose & Core Responsibility
- Defines the `ScrollButton` component, which acts as the physical, inline layout transition boundary of height `5vh` between individual content sections.
- Supports smooth scrolling to targeted sections and displays active feedback and transition state changes.
- Deprecates the previous floating overlay version of the navigation helper (`GlobalScrollArrows`).

## 2. Inbound & Outbound Communication Whitelist
- **Allowed Inbound (Who can talk TO this file):** 
  - `page.tsx` via component imports.
  - Individual section components (`hero.tsx`, `threat-model.tsx`, `features.tsx`, `code-sample.tsx`, `pricing.tsx`, `cta.tsx`) via direct React inclusion.
- **Explicitly Denied Inbound:** 
  - No external service, network call, or other components are allowed to directly call or run functions here.
- **Allowed Outbound (Who this file can talk TO):** 
  - DOM scroll interfaces (`window.scrollTo` or `Element.scrollIntoView`) for transitioning page states.
- **Explicitly Denied Outbound:** 
  - External network connections are strictly blocked.

## 3. Function & Method Manifest
- **`ScrollButton(props)`**
  - **Purpose:** Renders an inline scroll navigation boundary button between sections.
  - **Inputs & Sanitization:** React props interface `ScrollButtonProps` comprising:
    - `direction`: `"up" | "down"`
    - `targetId`: string (element ID, validated to ensure it exists in DOM)
    - `activeIdx`: number | null (currently active section index)
    - `currentSectionIdx`: number (index of the section enclosing this button)
    - `lastClickedDir`: `"up" | "down" | null` (optional direction tracker)
    - `onClick`: optional callback function
    - `label`: optional custom display string
  - **Outputs:** React button element of height `5vh` with interactive hover states and active transition feedback.
  - **Error States & Handling:** Safe fallback in case `targetId` does not exist in the DOM (defaults to silent drop without throwing runtime exceptions).

- **`GlobalScrollArrows()`**
  - **Purpose:** Deprecated placeholder to ensure backwards compatibility with page roots.
  - **Inputs & Sanitization:** None.
  - **Outputs:** `null`.

## 4. Security & Compliance Posture
- Runs entirely in the client browser runtime context (least privilege execution).
- Performs safe DOM querying without exposing internal application metadata.
