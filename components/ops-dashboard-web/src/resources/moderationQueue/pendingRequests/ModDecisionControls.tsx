// components/ops-dashboard-web/src/resources/moderationQueue/pendingRequests/ModDecisionControls.tsx
import React, { useState } from 'react';
import { Box, Button, Typography, Alert } from '@mui/material';
import { Check, X, Flag, AlertTriangle, ShieldCheck } from 'lucide-react';
import { IntakeRequest } from '../../../types/request.js';
import { usePolicy } from '../../../hooks/usePolicy.js';
import { useCurrentUser } from '../../../hooks/useCurrentUser.js';
import { httpClient } from '../../../dataProvider/httpClient.js';
import { ENDPOINTS } from '../../../dataProvider/endpoints.js';
import { ConfirmDialog } from '../../../components/shared/ConfirmDialog.js';
import { RequiredReasonField } from '../../../components/shared/RequiredReasonField.js';
import { tokens } from '@scatterid/design-tokens';

interface ModDecisionControlsProps {
  request: IntakeRequest;
  onDecisionComplete: () => void;
}

export const ModDecisionControls: React.FC<ModDecisionControlsProps> = ({
  request,
  onDecisionComplete,
}) => {
  const { policy, loading: policyLoading } = usePolicy();
  const { isMod, isRoot } = useCurrentUser();

  const [dialogAction, setDialogAction] = useState<'APPROVE' | 'REJECT' | 'FLAG' | null>(null);
  const [reason, setReason] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isMod && !isRoot) {
    return null;
  }

  // Live Policy Engine branching per Rule 5
  const channel = request.submission_channel || 'standard';
  const isRevocation = request.type === 'revoke' || (request as any).request_type === 'revocation';
  const issuanceRule = policy?.issuance?.[channel] || policy?.issuance?.standard || policy?.issuance?.hard;
  const willAutoExecute = !isRevocation && issuanceRule === 'AUTO_EXECUTE';

  const handleExecuteDecision = async () => {
    if (!dialogAction) return;
    if ((dialogAction === 'REJECT' || dialogAction === 'FLAG') && !reason.trim()) {
      setErrorMessage('Reason is required for rejection or escalation');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);
      await httpClient(ENDPOINTS.requests.modDecide(request.id), {
        method: 'POST',
        body: JSON.stringify({
          action: dialogAction,
          reason: reason.trim() || undefined,
        }),
      });
      setDialogAction(null);
      setReason('');
      onDecisionComplete();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit decision');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: tokens.color.borderLight }}>
      <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="caption" sx={{ color: tokens.color.slate500, fontWeight: 600 }}>
          Decision Routing: <span style={{ color: willAutoExecute ? tokens.color.approve : tokens.color.brand700, fontWeight: 700 }}>{willAutoExecute ? 'Direct Ledger Execution' : 'Escalates to Root Awaiting Queue'}</span>
        </Typography>
        {isRoot && (
          <Typography variant="caption" sx={{ color: tokens.color.rootTier, fontWeight: 700, ml: 'auto' }}>
            Root Authorization Enabled
          </Typography>
        )}
      </Box>

      {errorMessage && (
        <Alert severity="error" sx={{ mb: 2, backgroundColor: tokens.color.white, borderColor: tokens.color.reject }}>
          {errorMessage}
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
        <Button
          variant="contained"
          startIcon={<Check size={16} />}
          onClick={() => {
            setReason('');
            setDialogAction('APPROVE');
          }}
          disabled={submitting || policyLoading}
          sx={{
            backgroundColor: tokens.color.approve,
            color: '#ffffff',
            fontWeight: 700,
            '&:hover': { backgroundColor: '#15803d' },
          }}
        >
          {willAutoExecute ? 'Approve & Execute' : 'Approve & Escalate'}
        </Button>

        <Button
          variant="contained"
          startIcon={<X size={16} />}
          onClick={() => {
            setReason('');
            setDialogAction('REJECT');
          }}
          disabled={submitting}
          sx={{
            backgroundColor: tokens.color.reject,
            color: '#ffffff',
            fontWeight: 700,
            '&:hover': { backgroundColor: '#b91c1c' },
          }}
        >
          Reject
        </Button>

        <Button
          variant="contained"
          startIcon={<Flag size={16} />}
          onClick={() => {
            setReason('');
            setDialogAction('FLAG');
          }}
          disabled={submitting}
          sx={{
            backgroundColor: tokens.color.flag,
            color: '#ffffff',
            fontWeight: 700,
            '&:hover': { backgroundColor: '#c2410c' },
          }}
        >
          Flag for Review
        </Button>
      </Box>

      <ConfirmDialog
        open={Boolean(dialogAction)}
        title={
          dialogAction === 'APPROVE'
            ? willAutoExecute
              ? 'Confirm Approval & Ledger Execution'
              : 'Confirm Approval & Escalate to Root'
            : dialogAction === 'REJECT'
            ? 'Confirm Rejection'
            : 'Flag Request for Root Review'
        }
        message={
          dialogAction === 'APPROVE'
            ? willAutoExecute
              ? 'This approval will immediately trigger cryptographic signature and anchor the credential to the ledger.'
              : 'This approval will forward the request to the Root Administrator Awaiting Accept queue.'
            : dialogAction === 'REJECT'
            ? 'Rejecting will immediately terminate this request. Please provide mandatory justification.'
            : 'Flagging will pause processing and transfer this request to the Root Flagged queue for inspection.'
        }
        confirmLabel={dialogAction || 'Confirm'}
        isDestructive={dialogAction === 'REJECT'}
        onConfirm={handleExecuteDecision}
        onCancel={() => setDialogAction(null)}
      >
        {(dialogAction === 'REJECT' || dialogAction === 'FLAG') && (
          <Box sx={{ mt: 2 }}>
            <RequiredReasonField value={reason} onChange={setReason} />
          </Box>
        )}
      </ConfirmDialog>
    </Box>
  );
};
