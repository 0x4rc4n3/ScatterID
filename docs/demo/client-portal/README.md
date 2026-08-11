# ScatterID: Landing & Operator Presentation Portal MVP

This repository contains the Next.js presentation and marketing portal for the ScatterID platform. It introduces clients to the core concepts of ScatterID, features a high-fidelity interactive sandbox for testing post-quantum cryptography, and displays the pilot cohort pricing options.

---

## 🎨 Key Features & Sections

1. **Modern Sleek Interface**: Implements Outfit & Inter typography with customized dark mode grids, glowing glassmorphic elements, and micro-interactions.
2. **Interactive Post-Quantum Sandbox**: Allows prospective clients to run simulated sign/verify operations using ML-DSA-65 standards directly in the browser.
3. **Kyber/Dilithium Threat Model Grid**: Visualizes how threshold secret sharding and post-quantum cryptography mitigate attacks compared to traditional RSA/ECDSA systems.
4. **Interactive Pricing Model**: Custom interactive pricing cards detailing integration levels:
   - **Free / Open Source**: Evaluates post-quantum cryptography on local nodes (B2B SDK access, local containerized Fabric, post-quantum signing stress-testing harness).
   - **Enterprise Pilot Partner** (Custom / cohort): Standardized OIDC/SAML dual-stack bridge integration plugins for early pilot cohort universities and fintechs.
   - **Full Production Stack** (Volume / month): Dedicated infrastructure monitoring, customized sharding ($k/n$), and 24/7 cryptographic SLAs.

---

## 📁 Project Structure

```
MVP/
├── app/
│   ├── api/             # Lead generation & general inquiries API
│   ├── demo/            # Sandbox and diagnostics interactive routes
│   ├── globals.css      # Custom Tailwind CSS configuration and dark theme utilities
│   ├── layout.tsx       # Root layout configuration
│   └── page.tsx         # Master page loading all core sections
├── components/
│   └── landing/         # Marketing layout components (Hero, ThreatModel, Pricing, CTA)
├── package.json         # Project dependencies and script endpoints
└── tsconfig.json        # TypeScript configuration settings
```

---

## ⚡ Quick Start & Run Locally

### Prerequisites
- Node.js (v18 or higher)
- NPM, Bun, or Yarn

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Environment Configuration
Create a `.env.local` file at the root:
```ini
NEXT_PUBLIC_API_URL=http://localhost:3000
```

### 3. Launch Development Server
```bash
npm run dev
```
Open `http://localhost:8080` to view the portal.
