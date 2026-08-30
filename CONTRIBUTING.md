# Contributing to ScatterID

Thank you for your interest in contributing to ScatterID!

## Getting Started

1. Fork and clone the repository
2. Follow the setup instructions in [`docs/SETUP_AND_USAGE.md`](docs/SETUP_AND_USAGE.md)
3. Run `./scripts/check_deps.sh` to verify your local environment has all required tools
4. Run `./scripts/quickstart.sh` to automatically provision cryptographic keys and start the stack (or manually copy `.env.example` to `.env`)

> **Never commit `.env`** — it is gitignored to protect secrets.

## Development Workflow

1. Create a feature branch from `main`
2. Make your changes with clear, descriptive commits
3. Add or update tests for any new functionality
4. Ensure all tests pass locally:
   - **SDK:** `cd sdk && npm test`
   - **Verification API:** `cd components/verification-api && npm test`
   - **Crypto Service:** `cd components/crypto/crypto-service && python -m pytest`
5. Submit a pull request — CI will run automatically

## Code Standards

- **JavaScript/TypeScript:** ESM modules, consistent formatting
- **Python:** PEP 8, type hints where practical
- **Commit messages:** Descriptive imperative mood (e.g. `Fix TLS bypass in verification-api`)

## Cryptographic Dependencies

> **IMPORTANT:** Any version bumps to cryptographic dependencies (`flask`, `hvac`, `liboqs-python`, and any `crypto` JS packages) require manual review of changelogs before upgrading. Do not use caret (`^`) or tilde (`~`) version ranges for these packages.

## Security

For security vulnerabilities, do **not** open a public issue. See [SECURITY.md](SECURITY.md) for the responsible disclosure process.

## Questions?

Open a GitHub issue for general questions or feature discussions.
