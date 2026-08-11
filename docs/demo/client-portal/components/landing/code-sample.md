# Component Technical Specification: code-sample.tsx

## 1. Purpose & Core Responsibility
- Defines the `DeveloperIntegration` and `CodeSample` components of the ScatterID landing page, sized to exactly `100vh` height.
- Implements the tabbed interactive code snippet display (TypeScript, Python, and cURL) demonstrating SDK and API access interfaces.
- Structured with:
  - Top `5vh`: `ScrollButton` to go back up to features (`tech`).
  - Middle `90vh`: Section body containing headers and tabbed code preview container.
  - Bottom `5vh`: `ScrollButton` to proceed down to pricing tiers (`pricing`).

## 2. Inbound & Outbound Communication Whitelist
- **Allowed Inbound (Who can talk TO this file):** 
  - `page.tsx` via component rendering.
- **Explicitly Denied Inbound:** 
  - Direct endpoint accesses or external requests.
- **Allowed Outbound (Who this file can talk TO):** 
  - `global-scroll-arrows.tsx` via `ScrollButton` rendering.
  - Browser clipboard APIs via navigator copy triggers.
- **Explicitly Denied Outbound:** 
  - External networks are blocked.

## 3. Function & Method Manifest
- **`CodeSample()`**
  - **Purpose:** Renders the interactive code snippet block.
  - **Inputs & Sanitization:** Tabs choice state.
  - **Outputs:** Syntax-highlighted sample code container.
  
- **`DeveloperIntegration(props)`**
  - **Purpose:** Outer integration section page.
  - **Inputs & Sanitization:** React props `DeveloperIntegrationProps` consisting of:
    - `activeIdx`: number | null
    - `lastClickedDir`: `"up" | "down" | null`
    - `onScrollUp`: () => void
    - `onScrollDown`: () => void
  - **Outputs:** Responsive full screen page containing the integration details.
  - **Error States & Handling:** Code snippet tab selectors default safely to TypeScript if invalid indices are resolved.

## 4. Security & Compliance Posture
- Client-side static component with clipboard copy functionality bounded within standard browser security sandbox parameters.
