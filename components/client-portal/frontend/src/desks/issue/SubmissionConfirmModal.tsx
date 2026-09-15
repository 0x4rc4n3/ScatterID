// components/client-portal/frontend/src/desks/issue/SubmissionConfirmModal.tsx
import React from 'react';
import { ConfirmModal } from '../../components/shared/ConfirmModal.js';
import { IssueSubmissionPayload } from '../../types/issueRequest.js';

interface SubmissionConfirmModalProps {
  open: boolean;
  payload: IssueSubmissionPayload | null;
  onConfirm: () => void;
  onCancel: () => void;
  submitting?: boolean;
}

export const SubmissionConfirmModal: React.FC<SubmissionConfirmModalProps> = ({
  open,
  payload,
  onConfirm,
  onCancel,
  submitting = false,
}) => {
  if (!payload) return null;

  return (
    <ConfirmModal
      open={open}
      title="Confirm Credential Intake Submission"
      message={`You are submitting an intake application for ${payload.claimant_data.fullName} with verified in-person physical document checkpoints and attached document scan. This action will be recorded in the security audit trail.`}
      confirmLabel={submitting ? 'Submitting...' : 'Confirm & Submit to Queue'}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      <div className="mt-2 text-xs text-textLightMuted">
        Station: <span className="font-semibold text-textOnLight">{payload.station_id}</span>
      </div>
    </ConfirmModal>
  );
};
