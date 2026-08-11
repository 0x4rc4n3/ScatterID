# Component Technical Specification: hero.tsx

## 1. Purpose & Core Responsibility
- Defines the Hero Section component of the ScatterID landing page, sized to exactly `100vh` height.
- Coordinates the layout split:
  - Top `5vh`: `SiteNav` component.
  - Middle `90vh`: Brand title, value proposition, calls to action, and interactive particle backdrop.
  - Bottom `5vh`: `ScrollButton` to transition downstream to the threat model.

## 2. Inbound & Outbound Communication Whitelist
- **Allowed Inbound (Who can talk TO this file):** 
  - `page.tsx` via component inclusion and prop configuration.
- **Explicitly Denied Inbound:** 
  - Direct endpoint accesses or calls from outside the application module hierarchy.
- **Allowed Outbound (Who this file can talk TO):** 
  - `site-nav.tsx` via rendering.
  - `global-scroll-arrows.tsx` via `ScrollButton` rendering.
  - `sales-modal.tsx` via `SalesModal` rendering.
- **Explicitly Denied Outbound:** 
  - No external connections.

## 3. Function & Method Manifest
- **`Hero(props)`**
  - **Purpose:** Hero section layout component.
  - **Inputs & Sanitization:** React props `HeroProps` consisting of:
    - `activeIdx`: number | null
    - `lastClickedDir`: `"up" | "down" | null`
    - `onScrollDown`: () => void (callback invoked on scrolling down)
  - **Outputs:** Responsive full screen landing card with particle backdrop, brand title, and action hooks.
  - **Error States & Handling:** Safe component layout bounds protecting internal text containers from overflow using viewport unit scoping (`vh`).

## 4. Security & Compliance Posture
- Read-only navigation flow controls without direct DB writes or client-side execution parameters.
