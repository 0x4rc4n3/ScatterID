# ScatterID: Post-Quantum Decentralized Identity Ecosystem

## Overview
ScatterID is a decentralized identity (DID) ecosystem engineered to provide quantum-resistant security and zero-trust authentication. Developed as a Final Year Project, this system manages decentralized identifiers on a distributed ledger, successfully eradicating the need for centralized credential databases. 

## Architecture & Features

### 1. Mathematical Core
To secure cryptographic identities against quantum computational adversaries, ScatterID integrates **FIPS 204 ML-DSA-44 lattice-based digital signatures**. This post-quantum cryptographic foundation ensures that identity credentials remain mathematically secure against future quantum threats.

### 2. BFT Consensus Ledger
The system's backbone is a functional, private **3-node Byzantine Fault Tolerant (BFT) distributed ledger**. This decentralized architecture securely manages all identifiers without relying on a central authority.

### 3. Integration Ecosystem & Zero-Trust Authentication
ScatterID features a seamless, passwordless zero-trust authentication loop originally designed for integration within a Learning Management System (LMS). This is handled by two main components:
* **Client Wallet**: A custom Chrome Manifest V3 wallet extension.
* **Gateway API**: A backend built with Python and Flask that brokers the authentication requests.

## Tech Stack
* **Cryptography**: FIPS 204 ML-DSA-44
* **Consensus/Ledger**: Private 3-Node BFT
* **Backend**: Python, Flask
* **Frontend/Wallet**: Chrome Extension API (Manifest V3)

### Prerequisites
* Python 3.x
* Chrome/Chromium Browser (for testing the unpacked extension)
* *(Any dependencies for the BFT nodes)*

### Installation
1. Clone the repository: `git clone https://github.com/yourusername/ScatterID.git`
2. Initialize the 3-node BFT ledger.
3. Start the Python/Flask Gateway API.
4. Open Chrome, navigate to `chrome://extensions/`, enable "Developer mode", and load the unpacked extension folder.
