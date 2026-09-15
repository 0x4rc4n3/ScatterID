// components/client-portal/frontend/src/api/requestsApi.ts
// Calls THIS service's own /issue, /revoke, /track routes per §6

import { portalHttpClient } from './httpClient.js';
import { IssueSubmissionPayload, IssueSubmissionResponse } from '../types/issueRequest.js';
import { RevokeSubmissionPayload, RevokeSubmissionResponse } from '../types/revokeRequest.js';

export async function submitIssueRequest(
  payload: IssueSubmissionPayload
): Promise<IssueSubmissionResponse> {
  return portalHttpClient<IssueSubmissionResponse>('/issue', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function submitRevokeRequest(
  payload: RevokeSubmissionPayload
): Promise<RevokeSubmissionResponse> {
  return portalHttpClient<RevokeSubmissionResponse>('/revoke', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function trackRequest(requestId: string): Promise<any> {
  return portalHttpClient<any>(`/track/${encodeURIComponent(requestId)}`);
}
