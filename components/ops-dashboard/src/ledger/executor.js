// Verification API dispatcher: approvals are only complete after the API confirms its ledger result.

function apiConfig() {
  const baseUrl = process.env.VERIFICATION_API_URL?.replace(/\/$/, '');
  const apiKey = process.env.VERIFICATION_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new Error('Verification API is not configured (VERIFICATION_API_URL and VERIFICATION_API_KEY are required)');
  }
  return { baseUrl, apiKey };
}

async function postJson(url, apiKey, payload, { revoke = false } = {}) {
  const timeoutMs = Number.parseInt(process.env.VERIFICATION_API_TIMEOUT_MS || '10000', 10);
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` };
  if (revoke && process.env.REVOKE_API_KEY) headers['X-Revoke-Key'] = process.env.REVOKE_API_KEY;
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs)
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok && response.status !== 202) {
    throw new Error(body.error || body.message || `Verification API returned HTTP ${response.status}`);
  }
  return body;
}

export function createLedgerExecutor() {
  return {
    async executeIssuance(request) {
      if (!request?.id) throw new Error('Request record required for issuance execution');
      if (!/^[0-9a-f]{64}$/i.test(request.data_hash || '')) {
        throw new Error('Issuance request is missing a valid SHA3-256 data_hash commitment');
      }
      const { baseUrl, apiKey } = apiConfig();
      // The stable ops request ID is the idempotency key, preventing duplicate credentials on retries.
      let result = await postJson(`${baseUrl}/issue`, apiKey, {
        dataHash: request.data_hash.toLowerCase(),
        idempotencyKey: request.id
      });

      // A stored credential may be returned as pending if the API process stopped
      // after persistence but before completing its first ledger call.
      if (['anchor_failed', 'pending'].includes(result.status) && result.credentialId) {
        result = await postJson(
          `${baseUrl}/issue/${encodeURIComponent(result.credentialId)}/retry-anchor`,
          apiKey,
          {}
        );
      }
      if (result.status !== 'anchored' || !result.credentialId || !result.anchorTxId) {
        throw new Error(result.reason || result.error || `Verification API did not confirm ledger anchoring (status: ${result.status || 'unknown'})`);
      }
      return {
        status: 'anchored',
        credentialId: result.credentialId,
        anchorTxId: result.anchorTxId,
        txId: result.anchorTxId,
        issuanceReceipt: result
      };
    },

    async executeRevocation(request) {
      const credentialId = request?.credential_id || request?.credentialId;
      if (!credentialId) throw new Error('Credential ID is required for revocation execution');
      const { baseUrl, apiKey } = apiConfig();
      const result = await postJson(`${baseUrl}/revoke`, apiKey, { credentialId }, { revoke: true });
      if (!result.success || result.status !== 'revoked') {
        throw new Error(result.error || result.message || 'Verification API did not confirm revocation');
      }
      return { status: 'revoked', credentialId: result.credentialId || credentialId, txId: null, anchorTxId: null, issuanceReceipt: null };
    }
  };
}

export default createLedgerExecutor;
