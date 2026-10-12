# ScatterID TypeScript SDK source

This repository contains the SDK source in `sdk/`. It is not currently published under the `@scatterid/sdk` name on npm; verify registry availability before relying on a registry install command.

## Build and test locally

```bash
cd sdk
npm ci
npm run build
npm test
```

The build writes `dist/index.cjs` (CommonJS), `dist/index.js` (ES module), and TypeScript declarations to `dist/`.

The package is not currently on npm. To use it from a separate local project, build it, run `npm pack` from this directory, then install the generated `scatterid-sdk-1.0.0.tgz` file in the consuming project.

## Client setup

The constructor takes an API key and separate optional issuance and verification base URLs. It does not accept a single `apiUrl`, a `timeout`, or a `revokeApiKey` as a mandatory option.

```ts
import { ScatterIDClient } from '@scatterid/sdk';

const client = new ScatterIDClient({
  apiKey: process.env.VERIFICATION_API_KEY!,
  issuanceUrl: process.env.ISSUANCE_API_URL ?? 'http://localhost:3000',
  verificationUrl: process.env.VERIFICATION_API_URL ?? 'http://localhost:3000',
  revokeApiKey: process.env.REVOKE_API_KEY,
});
```

## Issue and verify

`issue(claim, idempotencyKey?)` creates a 16-byte random salt, canonicalizes the claim with RFC 8785, computes `SHA3-256(salt || canonicalClaim)`, and sends the resulting commitment and idempotency key to `/issue`. The claim itself and salt are not included in that request body. Keep the returned salt with the holder-side claim: it is needed to recompute the commitment later.

```ts
const claim = { subject: 'user-123', role: 'student' };
const issued = await client.issue(claim);
const verification = await client.verifyByClaim(
  claim,
  issued.salt,
  issued.credentialId,
);
if (!verification.valid) throw new Error(`Not verified: ${verification.reason ?? verification.anchorStatus}`);
```

`verifyByClaim(claim, salt, credentialId?)` recomputes the hash and calls `/verify`. `verifyByHash(dataHash, credentialId?)` sends a commitment directly. Verification also depends on the API's signature and ledger checks; offline freshness/revocation checks are not supplied by these SDK calls.

## Status, revocation, and history

```ts
const status = await client.getStatus(issued.credentialId);
const history = await client.getHistory(issued.credentialId);
const revoked = await client.revoke(issued.credentialId);
```

`revoke(credentialId, customRevokeKey?)` uses the configured revoke key when supplied, otherwise the regular API key. Configure distinct credentials and access controls in the deployment; do not put administrative keys in browser code.

Public interfaces are exported from `sdk/src/types.ts`. For exact response shapes and required services, see `components/verification-api/README.md`. The project license is PolyForm Noncommercial 1.0.0; see the repository-level `LICENSE`.
