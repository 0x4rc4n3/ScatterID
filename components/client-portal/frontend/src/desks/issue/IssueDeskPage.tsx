// components/client-portal/frontend/src/desks/issue/IssueDeskPage.tsx
import React, { useState } from 'react';
import { ClaimantDetailsSection } from './ClaimantDetailsSection.js';
import { HardChannelChecklist } from './HardChannelChecklist.js';
import { SoftChannelUpload } from './SoftChannelUpload.js';
import { AuditAttributionSummary } from './AuditAttributionSummary.js';
import { SubmissionConfirmModal } from './SubmissionConfirmModal.js';
import { submitIssueRequest } from '../../api/requestsApi.js';
import { useAuth } from '../../auth/useAuth.js';
import {
  IssueClaimantData,
  HardChecklistState,
  IssueSubmissionPayload,
} from '../../types/issueRequest.js';
import { Send, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';

export const IssueDeskPage: React.FC = () => {
  const { stationId } = useAuth();

  const [claimant, setClaimant] = useState<IssueClaimantData>({
    credentialType: 'CivilIdentityAttestation',
    subject: 'did:scatterid:record:8f92a10c',
    fullName: 'Alice M. Chen',
    identifierNumber: 'REC-9920148-X',
    issuingAuthority: 'Federal Civil Identity Registry',
    effectiveYear: 2026,
  });

  const [checklist, setChecklist] = useState<HardChecklistState>({
    substrate_material_integrity: true,
    optical_security_features: true,
    biometric_face_match: true,
    authority_seal_and_serial: true,
  });

  const [evidenceSha256, setEvidenceSha256] = useState<string>('9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08');
  const [evidencePayloadBase64, setEvidencePayloadBase64] = useState<string>('');
  const [confirmOpen, setConfirmOpen] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [successResponse, setSuccessResponse] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isChecklistReady = Object.values(checklist).every(Boolean);
  const canSubmit = claimant.fullName && claimant.identifierNumber && isChecklistReady;

  const payload: IssueSubmissionPayload = {
    submission_channel: 'hard',
    claimant_data: claimant,
    inspection_checklist: checklist,
    inspection_checklist_verified: isChecklistReady,
    evidence_sha256: evidenceSha256 || '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
    evidence_payload_base64: evidencePayloadBase64 || undefined,
    station_id: stationId,
  };

  const handleConfirmSubmit = async () => {
    try {
      setSubmitting(true);
      setErrorMessage(null);
      const res = await submitIssueRequest(payload);
      setSuccessResponse(res);
      setConfirmOpen(false);
    } catch (err: any) {
      setErrorMessage(err.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="w-5 h-5 text-brand500" />
          <h2 className="text-xl font-bold text-textOnLight">Credential Intake Desk</h2>
        </div>
        <p className="text-xs text-textLightMuted">
          Physical inspection verification and registration desk
        </p>
      </div>

      {successResponse && (
        <div className="mb-6 p-4 bg-emerald-50 border border-brand300 rounded-lg flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-brand500 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-brand700">Application Submitted</h4>
            <p className="text-xs text-brand700 mt-0.5">
              Request ID: <span className="font-mono font-bold">{successResponse.requestId || successResponse.request?.id || successResponse.id}</span>
            </p>
            <p className="text-xs text-textLightMuted mt-1">
              Forwarded to Operations Console Moderation Queue.
            </p>
            <button
              onClick={() => setSuccessResponse(null)}
              className="mt-2 text-xs font-semibold text-brand500 hover:underline"
            >
              Submit Another Application
            </button>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-sm text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <ClaimantDetailsSection claimant={claimant} onChange={setClaimant} />

      <HardChannelChecklist checklist={checklist} onChange={setChecklist} />

      <SoftChannelUpload
        evidenceSha256={evidenceSha256}
        onEvidenceChange={(hash, b64) => {
          setEvidenceSha256(hash);
          if (b64) setEvidencePayloadBase64(b64);
        }}
      />

      <AuditAttributionSummary channel="standard" claimantName={claimant.fullName} />

      <div className="flex justify-end">
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => setConfirmOpen(true)}
          className="flex items-center gap-2 px-6 py-2.5 bg-brand500 hover:bg-brand700 text-white font-bold text-sm rounded-md shadow-sm transition disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
          Submit Intake Request
        </button>
      </div>

      <SubmissionConfirmModal
        open={confirmOpen}
        payload={payload}
        submitting={submitting}
        onConfirm={handleConfirmSubmit}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
};
