# Component Technical Specification: pricing.tsx

## 1. Purpose & Core Responsibility
- Defines the Pricing Tiers Section of the ScatterID landing page, sized to exactly `100vh` height.
- Details the three service delivery options: Free / Open Source, Enterprise Pilot Partner, and Full Production Stack.
- Structured with:
  - Top `5vh`: `ScrollButton` to go back up to SDK integration (`integration`).
  - Middle `90vh`: Section body containing headers, introduction, and grid pricing cards.
  - Bottom `5vh`: `ScrollButton` to proceed down to roadmap CTA (`roadmap`).

## 2. Inbound & Outbound Communication Whitelist
- **Allowed Inbound (Who can talk TO this file):** 
  - `page.tsx` via component rendering.
- **Explicitly Denied Inbound:** 
  - Direct network requests or calling interfaces.
- **Allowed Outbound (Who this file can talk TO):** 
  - `global-scroll-arrows.tsx` via `ScrollButton` rendering.
  - `sales-modal.tsx` via `SalesModal` rendering.
- **Explicitly Denied Outbound:** 
  - External networks are blocked.

## 3. Function & Method Manifest
- **`Pricing(props)`**
  - **Purpose:** Pricing presentation card section.
  - **Inputs & Sanitization:** React props `PricingProps` consisting of:
    - `activeIdx`: number | null
    - `lastClickedDir`: `"up" | "down" | null`
    - `onScrollUp`: () => void
    - `onScrollDown`: () => void
  - **Outputs:** Responsive grid displaying pricing levels.
  - **Error States & Handling:** Handles smaller viewports safely by restricting height per card and routing overflow to local scroll boundaries (`overflow-y-auto`).

## 4. Security & Compliance Posture
- Static UI display code only, executing within client browser thread limits.
