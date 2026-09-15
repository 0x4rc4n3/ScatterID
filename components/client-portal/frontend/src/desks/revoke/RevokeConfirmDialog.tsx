// components/client-portal/frontend/src/desks/revoke/RevokeConfirmDialog.tsx
import React from 'react';
import { ConfirmModal } from '../../components/shared/ConfirmModal.js';
import { RevokeSubmissionPayload } from '../../types/revokeRequest.js';

interface RevokeConfirmDialogProps {
  open: boolean;
  payload: RevokeSubmissionPayload | null;
  onConfirm: () => void;
  onCancel: () => void;
  submitting?: boolean;
}

export const RevokeConfirmDialog: React.FC<RevokeConfirmDialogProps> = ({
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
      title="Confirm Credential Revocation Intake"
      message={`You are submitting an irreversible revocation request for credential "${payload.credential_id}". Per governance policy, all revocations gate to Root Administrator for final execution.`}
      confirmLabel={submitting ? 'Submitting...' : 'Submit Revocation Request'}
      isDestructive={true}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-xs text-red-800">
        Reason Code: <span className="font-bold">{payload.reason}</span>
      </div>
    </ConfirmModal>
  );
};
