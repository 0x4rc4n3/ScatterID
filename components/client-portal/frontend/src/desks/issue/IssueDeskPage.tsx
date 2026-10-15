// components/client-portal/frontend/src/desks/issue/IssueDeskPage.tsx
import React, { useState } from 'react';
import { ClaimantDetailsSection } from './ClaimantDetailsSection.js';
import { HardChannelChecklist } from './HardChannelChecklist.js';
import { AuditAttributionSummary } from './AuditAttributionSummary.js';
import { SubmissionConfirmModal } from './SubmissionConfirmModal.js';
import { getClaimantReceipt, submitIssueRequest } from '../../api/requestsApi.js';
import { useAuth } from '../../auth/useAuth.js';
import { IssueClaimantData, HardChecklistState, IssueSubmissionPayload } from '../../types/issueRequest.js';
import { generateClaimantReceiptToken, prepareClaimCommitment, downloadHolderBundle, HolderClaimBundle } from '../../utils/claimCommitment.js';
import { Send, CheckCircle2, AlertCircle, ShieldCheck, Download } from 'lucide-react';

const EMPTY_CLAIM: IssueClaimantData = { credentialType: 'CivilIdentityAttestation', subject: '', fullName: '', identifierNumber: '', issuingAuthority: '', effectiveYear: new Date().getFullYear() };
const EMPTY_CHECKLIST: HardChecklistState = { substrate_material_integrity: false, optical_security_features: false, biometric_face_match: false, authority_seal_and_serial: false };

export const IssueDeskPage: React.FC = () => {
  const { stationId } = useAuth();
  const [claimant, setClaimant] = useState<IssueClaimantData>({ ...EMPTY_CLAIM });
  const [checklist, setChecklist] = useState<HardChecklistState>({ ...EMPTY_CHECKLIST });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successResponse, setSuccessResponse] = useState<any | null>(null);
  const [holderBundle, setHolderBundle] = useState<HolderClaimBundle | null>(null);
  const [checkingReceipt, setCheckingReceipt] = useState(false);
  const [receiptMessage, setReceiptMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isChecklistReady = Object.values(checklist).every(Boolean);
  const canSubmit = Boolean(claimant.fullName.trim() && claimant.identifierNumber.trim() && claimant.subject.trim() && isChecklistReady);
  const payload: IssueSubmissionPayload = { submission_channel: 'hard', data_hash: holderBundle?.dataHash || '', claimant_receipt_token: holderBundle?.receiptToken || '', inspection_checklist: checklist, inspection_checklist_verified: isChecklistReady, station_id: stationId };

  const handleConfirmSubmit = async () => {
    try {
      setSubmitting(true); setErrorMessage(null);
      let localBundle = holderBundle;
      if (!localBundle) {
        const commitment = prepareClaimCommitment(claimant);
        localBundle = { version: 1, claim: claimant, salt: commitment.salt, dataHash: commitment.dataHash, receiptToken: generateClaimantReceiptToken() };
        setHolderBundle(localBundle);
        // Save the only copy of claim, salt and receipt secret before any network request.
        downloadHolderBundle(localBundle);
      }
      const response = await submitIssueRequest({ submission_channel: 'hard', data_hash: localBundle.dataHash, claimant_receipt_token: localBundle.receiptToken!, inspection_checklist: checklist, inspection_checklist_verified: isChecklistReady, station_id: stationId });
      const savedBundle = { ...localBundle, requestId: response.requestId };
      setHolderBundle(savedBundle); setSuccessResponse(response); downloadHolderBundle(savedBundle); setConfirmOpen(false);
    } catch (err: any) {
      setErrorMessage(err.message || 'Submission failed. Keep your recovery file; retrying will reuse the same commitment and receipt token.');
    } finally { setSubmitting(false); }
  };

  const checkReceipt = async () => {
    if (!holderBundle?.receiptToken) return;
    setCheckingReceipt(true); setReceiptMessage(null);
    try {
      const result = await getClaimantReceipt(holderBundle.requestId, holderBundle.receiptToken);
      if (result.status !== 'issued' || !result.credential) {
        if (result.requestId && !holderBundle.requestId) setHolderBundle({ ...holderBundle, requestId: result.requestId });
        setReceiptMessage(`Still awaiting final approval or ledger confirmation (request status: ${result.status || 'pending'}).`);
        return;
      }
      const updated = { ...holderBundle, requestId: result.requestId || holderBundle.requestId, credential: result.credential };
      setHolderBundle(updated); downloadHolderBundle(updated);
      setReceiptMessage('The signed credential was added to your private recovery file. Keep the updated file securely.');
    } catch (err: any) { setReceiptMessage(err.message || 'Receipt could not be retrieved. Keep your recovery file and try again later.'); }
    finally { setCheckingReceipt(false); }
  };

  const startAnother = () => { setSuccessResponse(null); setHolderBundle(null); setClaimant({ ...EMPTY_CLAIM }); setChecklist({ ...EMPTY_CHECKLIST }); setReceiptMessage(null); setErrorMessage(null); };

  return <div className="max-w-4xl mx-auto py-8 px-4">
    <div className="mb-6"><div className="flex items-center gap-2 mb-1"><ShieldCheck className="w-5 h-5 text-brand500" /><h2 className="text-xl font-bold text-textOnLight">Credential Intake Desk</h2></div><p className="text-xs text-textLightMuted">Claim data stays in this browser; Operations receives only a salted commitment and inspection metadata.</p></div>
    {successResponse && holderBundle && <div className="mb-6 p-4 bg-emerald-50 border border-brand300 rounded-lg"><div className="flex items-start gap-3"><CheckCircle2 className="w-5 h-5 text-brand500 flex-shrink-0 mt-0.5" /><div className="min-w-0"><h4 className="text-sm font-bold text-brand700">Commitment submitted</h4><p className="text-xs text-brand700 mt-0.5">Request ID: <span className="font-mono font-bold">{successResponse.requestId}</span></p><p className="text-xs text-textLightMuted mt-1">A private recovery file containing the claim, salt, and receipt token was downloaded. Keep it with the claimant; Operations cannot recreate the claim or salt.</p><p className="text-xs font-mono text-textLightMuted mt-1 break-all">Commitment: {holderBundle.dataHash}</p>{holderBundle.credential ? <p className="mt-2 text-xs font-semibold text-emerald-800">Signed credential receipt is included in this recovery file.</p> : <button onClick={checkReceipt} disabled={checkingReceipt} className="mt-3 block text-xs font-semibold text-brand500 hover:underline disabled:opacity-50">{checkingReceipt ? 'Checking…' : 'Check for approved credential'}</button>}{receiptMessage && <p className="mt-2 text-xs text-textLightMuted">{receiptMessage}</p>}<button onClick={() => downloadHolderBundle(holderBundle)} className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-brand500 hover:underline"><Download className="w-4 h-4" /> Download recovery file again</button><button onClick={startAnother} className="ml-4 mt-3 text-xs font-semibold text-brand500 hover:underline">Submit Another Application</button></div></div></div>}
    {errorMessage && <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-sm text-red-700"><AlertCircle className="w-5 h-5 flex-shrink-0" /><span>{errorMessage}</span></div>}
    {!successResponse && <>
      {holderBundle && <div className="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">A recovery bundle has already been prepared. The claim fields are locked so retries cannot mismatch the saved commitment.</div>}
      <ClaimantDetailsSection claimant={claimant} onChange={setClaimant} disabled={Boolean(holderBundle)} />
      <HardChannelChecklist checklist={checklist} onChange={setChecklist} />
      <AuditAttributionSummary channel="hard" claimantName="Claim held locally" />
      <div className="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">The recovery file is unencrypted JSON containing the private claim, salt, and receipt token. Store it securely or encrypt it with your own storage tool; never send it to Operations or anyone who should not see the claim.</div>
      <div className="flex justify-end"><button type="button" disabled={!canSubmit} onClick={() => setConfirmOpen(true)} className="flex items-center gap-2 px-6 py-2.5 bg-brand500 hover:bg-brand700 text-white font-bold text-sm rounded-md shadow-sm transition disabled:opacity-50"><Send className="w-4 h-4" /> Submit Commitment</button></div>
      <SubmissionConfirmModal open={confirmOpen} payload={payload} claimantName={claimant.fullName} submitting={submitting} onConfirm={handleConfirmSubmit} onCancel={() => setConfirmOpen(false)} />
    </>}
  </div>;
};
