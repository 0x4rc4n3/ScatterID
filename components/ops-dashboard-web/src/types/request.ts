// components/ops-dashboard-web/src/types/request.ts

export type SubmissionChannel = 'hard' | 'soft' | string;
export type RequestType = 'issue' | 'revoke' | 'issuance' | 'revocation' | string;
export type RequestStatus =
  | 'pending'
  | 'awaiting_root'
  | 'flagged'
  | 'approved'
  | 'rejected'
  | 'executed'
  | 'PENDING'
  | 'AWAITING_ROOT_ACCEPT'
  | 'FLAGGED'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXECUTED'
  | string;

export interface InspectionChecklist {
  substrate_material_integrity?: boolean | number;
  optical_security_features?: boolean | number;
  biometric_face_match?: boolean | number;
  authority_seal_and_serial?: boolean | number;
}

export interface IntakeRequest {
  id: string;
  type?: RequestType;
  request_type?: string;
  submission_channel?: SubmissionChannel;
  status: RequestStatus;
  claimant_data?: Record<string, unknown> | string;
  inspection_checklist?: InspectionChecklist;
  inspection_checklist_verified?: boolean | number;
  evidence_sha256?: string | null;
  evidence_payload_base64?: string | null;
  station_id?: string;
  created_by?: string;
  created_at: string;
  moderator_id?: string | null;
  moderator_username?: string | null;
  moderator_decision?: string | null;
  moderator_action?: string | null;
  moderator_notes?: string | null;
  moderator_reason?: string | null;
  flag_reason?: string | null;
  root_id?: string | null;
  root_username?: string | null;
  root_decision?: string | null;
  root_action?: string | null;
  root_notes?: string | null;
  root_reason?: string | null;
  automated_notes?: string | null;
  target_credential_id?: string | null;
  credential_id?: string | null;
  revocation_reason?: string | null;
  ledger_tx_id?: string | null;
  execution_tx_id?: string | null;
  data_hash?: string | null;
  [key: string]: any;
}
