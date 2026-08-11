# Component Technical Specification: threat-model.tsx

## 1. Purpose & Core Responsibility
- Defines the Threat Model Section of the ScatterID landing page, sized to exactly `100vh` height.
- Provides a side-by-side comparison between traditional quantum attack models ("Harvest Now, Decrypt Later") and the ScatterID defense suite.
- Adheres to the layout standard:
  - Top `5vh`: `ScrollButton` to go back up to Hero (`top`).
  - Middle `90vh`: Section body containing headers, explanatory text, and side-by-side details cards.
  - Bottom `5vh`: `ScrollButton` to proceed down to features (`tech`).

## 2. Inbound & Outbound Communication Whitelist
- **Allowed Inbound (Who can talk TO this file):** 
  - `page.tsx` via rendering.
- **Explicitly Denied Inbound:** 
  - Direct network requests or caller modules from outside components.
- **Allowed Outbound (Who this file can talk TO):** 
  - `global-scroll-arrows.tsx` via `ScrollButton` rendering.
- **Explicitly Denied Outbound:** 
  - External network pipelines are blocked.

## 3. Function & Method Manifest
- **`ThreatModel(props)`**
  - **Purpose:** Threat Model presentation card.
  - **Inputs & Sanitization:** React props `ThreatModelProps` consisting of:
    - `activeIdx`: number | null
    - `lastClickedDir`: `"up" | "down" | null`
    - `onScrollUp`: () => void
    - `onScrollDown`: () => void
  - **Outputs:** Responsive Threat Model information section.
  - **Error States & Handling:** Uses flex container bounds and vertical scrolling (`overflow-y-auto`) to guarantee zero text container overlaps on smaller screens.

## 4. Security & Compliance Posture
- Simple client-side rendering block with no elevated security capabilities or direct API executions.
