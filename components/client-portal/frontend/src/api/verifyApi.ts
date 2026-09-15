// components/client-portal/frontend/src/api/verifyApi.ts
// Calls THIS service's own /verify route (live) per §6

import { portalHttpClient } from './httpClient.js';
import { LiveVerifyResult } from '../types/verifyResult.js';

export async function verifyLive(params: {
  credentialId?: string;
  dataHash?: string;
}): Promise<LiveVerifyResult> {
  const result = await portalHttpClient<any>('/verify', {
    method: 'POST',
    body: JSON.stringify(params),
  });

  return {
    mode: 'live',
    valid: Boolean(result.valid),
    anchorStatus: result.anchorStatus || (result.valid ? 'active' : 'invalid'),
    issuedAt: result.issuedAt,
    reason: result.reason,
    credentialId: params.credentialId,
    dataHash: params.dataHash,
  };
}
