# ScatterID TypeScript SDK (`@scatterid/sdk`)

Official client SDK for integrating **ScatterID** post-quantum zero-knowledge credential issuance, verification, and on-chain lifecycle management into Node.js, web, and backend applications.

---

## 1. Installation & Build

```bash
# Install dependencies
npm install

# Build CommonJS, ES Module, and TypeScript declaration bundles (.d.ts) via tsup
npm run build
```

Build outputs are generated in `sdk/dist/`:
- `index.js` (CommonJS)
- `index.mjs` (ES Modules)
- `index.d.ts` (TypeScript types)

---

## 2. Client Initialization & Configuration

The SDK enforces privilege separation between standard verification traffic and administrative revocation operations:

```typescript
import { ScatterIDClient } from '@scatterid/sdk';

const client = new ScatterIDClient({
  apiUrl: 'http://localhost:3000',
  apiKey: process.env.VERIFICATION_API_KEY,      // Required for issuance & verification
  revokeApiKey: process.env.REVOKE_API_KEY,      // Required for administrative revocation
  timeout: 5000,                                 // Optional request timeout in ms
});
```

---

## 3. API Reference & Usage

### 1. Issue Credential
```typescript
const issuanceResult = await client.issue({
  holderId: 'did:key:z6MkuT...',
  claims: {
    name: 'Alice Smith',
    ageOver21: true,
    jurisdiction: 'US-CA',
  },
});

console.log('Issued Credential ID:', issuanceResult.credentialId);
console.log('Post-Quantum Signature:', issuanceResult.signature);
```

### 2. Verify Credential
```typescript
const verification = await client.verify(issuanceResult);

if (verification.valid && verification.status === 'active') {
  console.log('Credential verified successfully. Post-quantum signature is authentic.');
}
```

### 3. Query Credential Status & History
```typescript
// Query current status
const status = await client.getStatus('7afa6a77-fba6-4cfa-928e-9a4c5cb41ce1');
console.log('Current status:', status.status); // "active" | "revoked"

// Query full chronological ledger provenance
const history = await client.getHistory('7afa6a77-fba6-4cfa-928e-9a4c5cb41ce1');
for (const item of history.history) {
  console.log(`Tx ${item.txId} at ${item.timestamp}: status=${item.record.status}`);
}
```

### 4. Administrative Revocation
```typescript
// Revocation automatically uses the configured revokeApiKey
const revocation = await client.revoke('7afa6a77-fba6-4cfa-928e-9a4c5cb41ce1');
console.log('Revocation transaction confirmed:', revocation.txId);

// Alternatively, supply an explicit per-call revocation key:
await client.revoke('7afa6a77-fba6-4cfa-928e-9a4c5cb41ce1', 'emergency-override-key');
```

---

## 4. TypeScript Interfaces

Exported types in `src/types.ts`:
- `ScatterIDClientOptions`: Client constructor options (`apiUrl`, `apiKey`, `revokeApiKey`, `timeout`).
- `ProofRecordHistoryItem`: Fabric historical key modification record (`txId`, `timestamp`, `isDelete`, `record`).
- `HistoryResponse`: Response wrapper containing the chronological history array.
- `Credential`: Core credential structure containing claims, commitments, salts, and post-quantum signatures.

---

## 5. Testing

The SDK includes a Jest test suite with mocked gateway interactions:

```bash
# Run SDK unit tests
npm test
```

### Coverage (6/6 tests passing)
- Client initialization with custom and default parameters
- Issuance request serialization and response parsing
- Verification request and response validation
- Status endpoint querying
- Revocation with dedicated `revokeApiKey` and per-call override
- History queries via `getHistory()`
