# Enterprise Deep-Tech Operator Control Dashboard

The `project-dashboard` microservice serves the ScatterID Operator Presentation Portal, providing interactive node fault simulation, deep-tech cryptographic telemetry, real-time log monitoring, and direct REST claim issuance.

---

## 🎨 UI Architecture & Features

   - Live status monitoring of Nodes 1..5.
   - Interactive **Simulate Fault (Stop)** and **Recover Node (Auto-Heal)** controls backed by real Docker container execution (`docker stop` / `docker start`).
   - Animated spinner loading indicators during container state transitions.

2. **Issued Credentials & Database Explorer**:
   - Multi-node SQLite record viewer with expandable/copyable cells for long base64/hex signature payloads and SHA3-256 hashes.

3. **Hyperledger Fabric Log Streamer**:
   - Full-height static log window with internal scrolling for real-time Peer & Orderer log output (`calc(100vh - 200px)`).

4. **Issue & Anchor Control Section**:
