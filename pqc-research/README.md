# PQC-Identity Research & Analytics Suite

This directory contains the standalone research infrastructure for the KFUEIT PQC-IDP project. It is designed to evaluate student acceptance of Post-Quantum Cryptography in a university environment.

## 🚀 Components

### 1. The Participation Portal (`/participate`)
A layman-friendly 6-stage wizard that guides participants from "Profile Search" to "Digital Identity Setup" and finally "PQC Authentication."
- **Encryption**: ML-DSA-44 (Dilithium2).
- **Goal**: High-throughput participant data collection.
- **PIN**: `1234` (Simplified for research ease).

### 2. The Statistical Research Ledger (`/`)
A sophisticated dashboard that provides real-time quantitative and qualitative analysis of the study results.
- **Factor Matrix**: Detailed $\mu$, $\sigma$, and p-value metrics for 8 TAM constructs.
- **Likert Distribution**: Percentage frequency of scores 1 through 5.
- **Inference Engine**: Automated research conclusions based on telemetry.
- **Qualitative Gallery**: High-quality "Participant Voice" snippets.

## 📊 Running the Suite

1.  **Initialize Data**: Run the research server to begin collecting telemetry.
    ```bash
    python3 research_app.py
    ```
2.  **Access Research Dashboard**: `http://localhost:8081`
3.  **Launch Study Participation**: `http://localhost:8081/participate`

## 📂 Data Structure
- `usability_study.json`: The primary research ledger containing all participant telemetry.
- `RESEARCH_METHODOLOGY.md`: Detailed breakdown of the study framework.
- `RESEARCH_PAPER.md`: Final draft of the research findings and conclusions.

---

*Part of the KFUEIT Post-Quantum Decentralized Identity Project.*
