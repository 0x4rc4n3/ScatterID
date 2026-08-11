# Component Technical Specification: cta.tsx

## 1. Purpose & Core Responsibility
- Defines the CTA / Roadmap Section of the ScatterID landing page, sized to exactly `100vh` height.
- Displays a prominent call-to-action for recruiting team members and pilot program interest.
- Structured with:
  - Top `5vh`: `ScrollButton` to go back up to pricing (`pricing`).
  - Middle `90vh`: Section body containing headers, value descriptions, and join actions.
  - Bottom `5vh`: Compact page footer displaying copyright statement and a "Back to Top" scrolling button.

## 2. Inbound & Outbound Communication Whitelist
- **Allowed Inbound (Who can talk TO this file):** 
  - `page.tsx` via component rendering.
- **Explicitly Denied Inbound:** 
  - External callers or network operations.
- **Allowed Outbound (Who this file can talk TO):** 
  - `global-scroll-arrows.tsx` via `ScrollButton` rendering.
  - `join-modal.tsx` via `JoinModal` rendering.
- **Explicitly Denied Outbound:** 
  - External networks are blocked.

## 3. Function & Method Manifest
- **`CTA(props)`**
  - **Purpose:** Call to action presentation component.
  - **Inputs & Sanitization:** React props `CTAProps` consisting of:
    - `activeIdx`: number | null
    - `lastClickedDir`: `"up" | "down" | null`
    - `onScrollUp`: () => void
    - `onScrollToTop`: () => void
  - **Outputs:** Responsive CTA section featuring a compact footer and scroll-to-top trigger.
  - **Error States & Handling:** Fallback layouts prevent text cutoff on small screen resolutions using `overflow-y-auto`.

## 4. Security & Compliance Posture
- Client-side static presentation view execution, constrained within standard browser runtime environments.
