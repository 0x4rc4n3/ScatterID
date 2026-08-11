# Component Technical Specification: features.tsx

## 1. Purpose & Core Responsibility
- Defines the Features Section of the ScatterID landing page, sized to exactly `100vh` height.
- Showcases the 6 core architectural capabilities of the ScatterID platform in a responsive grid grid layout.
- Structured with:
  - Top `5vh`: `ScrollButton` to go back up to threat model (`problem`).
  - Middle `90vh`: Section body containing headers, introduction, and grid features cards.
  - Bottom `5vh`: `ScrollButton` to proceed down to SDK integration (`integration`).

## 2. Inbound & Outbound Communication Whitelist
- **Allowed Inbound (Who can talk TO this file):** 
  - `page.tsx` via component rendering.
- **Explicitly Denied Inbound:** 
  - Direct calling or external network requests.
- **Allowed Outbound (Who this file can talk TO):** 
  - `global-scroll-arrows.tsx` via `ScrollButton` rendering.
- **Explicitly Denied Outbound:** 
  - External networks are blocked.

## 3. Function & Method Manifest
- **`Features(props)`**
  - **Purpose:** Features presentation component.
  - **Inputs & Sanitization:** React props `FeaturesProps` consisting of:
    - `activeIdx`: number | null
    - `lastClickedDir`: `"up" | "down" | null`
    - `onScrollUp`: () => void
    - `onScrollDown`: () => void
  - **Outputs:** Responsive grid displaying ScatterID core capabilities.
  - **Error States & Handling:** Handled overflow cleanly on mobile via viewport scaling and wrapper `overflow-y-auto`.

## 4. Security & Compliance Posture
- Client-side static rendering only, execution isolated to the client browser thread boundary.
