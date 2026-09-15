// components/client-portal/frontend/src/types/issueRequest.ts

export type SubmissionChannel = 'hard' | 'soft';

export interface HardChecklistState {
  substrate_material_integrity: boolean;
  optical_security_features: boolean;
  biometric_face_match: boolean;
  authority_seal_and_serial: boolean;
}

export interface IssueClaimantData {
  credentialType: string;
  subject: string;
  fullName: string;
  identifierNumber: string;
  issuingAuthority: string;
  effectiveYear: number;
  [key: string]: unknown;
}

export interface IssueSubmissionPayload {
  submission_channel: SubmissionChannel;
  claimant_data: IssueClaimantData;
  inspection_checklist?: HardChecklistState;
  inspection_checklist_verified?: boolean;
  evidence_sha256?: string;
  evidence_payload_base64?: string;
  station_id?: string;
  reason?: string;
}

export interface IssueSubmissionResponse {
  success: boolean;
  requestId: string;
  status: string;
  submission_channel: SubmissionChannel;
  created_at: string;
}
