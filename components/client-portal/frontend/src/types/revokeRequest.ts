// components/client-portal/frontend/src/types/revokeRequest.ts

export type RevocationReason =
  | 'KEY_COMPROMISE'
  | 'LOST_CREDENTIAL'
  | 'ERRONEOUS_ISSUANCE'
  | 'ADMINISTRATIVE_ACTION'
  | 'CHANGE_IN_CIRCUMSTANCES';

export interface RevokeSubmissionPayload {
  credential_id: string;
  reason: RevocationReason | string;
  justification?: string;
  station_id?: string;
}

export interface RevokeSubmissionResponse {
  success: boolean;
  requestId: string;
  status: string;
  created_at: string;
}
