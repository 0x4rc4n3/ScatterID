// components/client-portal/frontend/src/desks/revoke/RevokeDeskPage.tsx
import React, { useState } from 'react';
import { CredentialIdSearch } from './CredentialIdSearch.js';
import { RevocationReasonSelect } from './RevocationReasonSelect.js';
import { RevokeConfirmDialog } from './RevokeConfirmDialog.js';
import { submitRevokeRequest } from '../../api/requestsApi.js';
import { useAuth } from '../../auth/useAuth.js';
import { RevocationReason, RevokeSubmissionPayload } from '../../types/revokeRequest.js';
import { ShieldAlert, CheckCircle2, AlertCircle } from 'lucide-react';

export const RevokeDeskPage: React.FC = () => {
  const { stationId } = useAuth();
  const [credentialId, setCredentialId] = useState<string>('');
  const [reason, setReason] = useState<RevocationReason>('KEY_COMPROMISE');
  const [justification, setJustification] = useState<string>('');
  const [confirmOpen, setConfirmOpen] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [successResponse, setSuccessResponse] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const payload: RevokeSubmissionPayload = {
    credential_id: credentialId.trim(),
    reason,
    justification: justification.trim(),
    station_id: stationId,
  };

  const canSubmit = credentialId.trim().length > 0 && justification.trim().length > 0;

  const handleConfirmRevoke = async () => {
    try {
      setSubmitting(true);
      setErrorMessage(null);
      const res = await submitRevokeRequest(payload);
      setSuccessResponse(res);
      setConfirmOpen(false);
    } catch (err: any) {
      setErrorMessage(err.message || 'Revocation submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-textOnLight">Credential Revocation Desk</h2>
        <p className="text-sm text-textLightMuted">
          Initiate high-assurance revocation of lost, stolen, or compromised credentials. Requests escalate to Root authorization.
        </p>
      </div>

      {successResponse && (
        <div className="mb-6 p-4 bg-emerald-50 border border-brand300 rounded-lg flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-brand500 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-brand700">Revocation Request Successfully Queued</h4>
            <p className="text-xs text-brand700 mt-0.5">
              Request ID: <span className="font-mono font-bold">{successResponse.requestId || successResponse.id}</span>
            </p>
            <p className="text-xs text-textLightMuted mt-1">
              Revocation request queued and routed to Root Administrator queue (Four-Eyes security rule).
            </p>
            <button
              onClick={() => {
                setSuccessResponse(null);
                setCredentialId('');
                setJustification('');
              }}
              className="mt-2 text-xs font-semibold text-brand500 hover:underline"
            >
              Submit Another Revocation
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

      <div className="bg-white p-6 rounded-lg border border-borderLight shadow-sm mb-6">
        <CredentialIdSearch value={credentialId} onChange={setCredentialId} />
        <RevocationReasonSelect
          reason={reason}
          onReasonChange={setReason}
          justification={justification}
          onJustificationChange={setJustification}
        />
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => setConfirmOpen(true)}
          className="flex items-center gap-2 px-6 py-2.5 bg-reject hover:opacity-90 text-white font-bold text-sm rounded-md shadow-sm transition disabled:opacity-50"
        >
          <ShieldAlert className="w-4 h-4" />
          Submit Revocation Request
        </button>
      </div>

      <RevokeConfirmDialog
        open={confirmOpen}
        payload={payload}
        submitting={submitting}
        onConfirm={handleConfirmRevoke}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
};
