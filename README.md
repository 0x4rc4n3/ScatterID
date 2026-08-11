# ScatterID

All project documentation for ScatterID has been organized and moved to the centralized [`docs/`](file:///home/arcane/ScatterID/docs) folder:

- 🏛 **System Architecture & Design**: [`docs/system/README.md`](file:///home/arcane/ScatterID/docs/system/README.md)
- ⚙️ **Setup & Usage Guide**: [`docs/system/SETUP_AND_USAGE.md`](file:///home/arcane/ScatterID/docs/system/SETUP_AND_USAGE.md)
- 🧪 **E2E Test Suites**: [`docs/system/test_all.md`](file:///home/arcane/ScatterID/docs/system/test_all.md)
- 📝 **Project Journal**: [`docs/system/project-journal.md`](file:///home/arcane/ScatterID/docs/system/project-journal.md)
- 💻 **Demo Spec**: [`docs/demo/client-portal/README.md`](file:///home/arcane/ScatterID/docs/demo/client-portal/README.md)
- 🛡 **MVP Spec**: [`docs/mvp/operator-console/README.md`](file:///home/arcane/ScatterID/docs/mvp/operator-console/README.md)
- 🛠 **Real Product Spec**: See subfolders in [`docs/product/`](file:///home/arcane/ScatterID/docs/product) (e.g. `verification-api`, `crypto-service`, `shard-node`, `blockchain`, `billing-aggregator`).

---

### 📁 Operational Folders

- 🛠 [**`scripts/`**](file:///home/arcane/ScatterID/scripts): Helper and orchestration scripts.
  - [`scripts/check_deps.sh`](file:///home/arcane/ScatterID/scripts/check_deps.sh): Audits system requirements.
  - [`scripts/start.sh`](file:///home/arcane/ScatterID/scripts/start.sh): Boots the 14-container stack, configures KMS Vault, and maps Fabric nodes.
  - [`scripts/test_all.sh`](file:///home/arcane/ScatterID/scripts/test_all.sh): Executes the complete integration and cryptographic verification suite.
  - [`scripts/test_fault_tolerance.sh`](file:///home/arcane/ScatterID/scripts/test_fault_tolerance.sh): Tests $k$-of-$n$ Shamir Secret Sharing reconstruction by toggling containers.
- 🎨 [**`brand/`**](file:///home/arcane/ScatterID/brand): Branding and design assets (`logo.png`, `icon.png`).
