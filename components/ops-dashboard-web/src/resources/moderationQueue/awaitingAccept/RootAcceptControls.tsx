// components/ops-dashboard-web/src/resources/moderationQueue/awaitingAccept/RootAcceptControls.tsx
import React, { useState } from 'react';
import { Box, Button, Typography, Alert } from '@mui/material';
import { Check, X, ShieldAlert } from 'lucide-react';
import { IntakeRequest } from '../../../types/request.js';
import { httpClient } from '../../../dataProvider/httpClient.js';
import { ENDPOINTS } from '../../../dataProvider/endpoints.js';
import { ConfirmDialog } from '../../../components/shared/ConfirmDialog.js';
import { RequiredReasonField } from '../../../components/shared/RequiredReasonField.js';
import { tokens } from '@scatterid/design-tokens';

interface RootAcceptControlsProps {
  request: IntakeRequest;
  onDecisionComplete: () => void;
}

export const RootAcceptControls: React.FC<RootAcceptControlsProps> = ({
  request,
  onDecisionComplete,
}) => {
  const [dialogAction, setDialogAction] = useState<'ACCEPT' | 'REJECT' | null>(null);
  const [reason, setReason] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleExecute = async () => {
    if (!dialogAction) return;
    if (dialogAction === 'REJECT' && !reason.trim()) {
      setErrorMessage('A rejection reason is mandatory for audit attribution');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);
      await httpClient(ENDPOINTS.requests.rootExecute(request.id), {
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
      setErrorMessage(err.message || 'Execution failed on ledger');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: tokens.color.borderSubtle }}>
      <Box sx={{ mb: 2 }}>
        <Typography variant="caption" sx={{ color: tokens.color.rootTier, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <ShieldAlert size={14} /> Root Execution Authority
        </Typography>
      </Box>

      {errorMessage && (
        <Alert severity="error" sx={{ mb: 2, backgroundColor: tokens.color.bgCard }}>
          {errorMessage}
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 1.5 }}>
        <Button
          variant="contained"
          startIcon={<Check size={16} />}
          onClick={() => {
            setReason('');
            setDialogAction('ACCEPT');
          }}
          disabled={submitting}
          sx={{
            backgroundColor: tokens.color.rootTier,
            color: '#ffffff',
            fontWeight: 700,
            '&:hover': { backgroundColor: tokens.color.brand700 },
          }}
        >
          Authorize & Execute
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
          Reject Request
        </Button>
      </Box>

      <ConfirmDialog
        open={Boolean(dialogAction)}
        title={dialogAction === 'ACCEPT' ? 'Confirm Ledger Commitment' : 'Confirm Request Rejection'}
        message={
          dialogAction === 'ACCEPT'
            ? 'This action will finalize the credential and append the transaction to Hyperledger Fabric. This cannot be undone.'
            : 'Rejecting this request will mark it REJECTED in the audit trail. Please specify the mandatory reason.'
        }
        confirmLabel={dialogAction === 'ACCEPT' ? 'Commit to Ledger' : 'Confirm Rejection'}
        isDestructive={dialogAction === 'REJECT'}
        onConfirm={handleExecute}
        onCancel={() => setDialogAction(null)}
      >
        {dialogAction === 'REJECT' && (
          <Box sx={{ mt: 2 }}>
            <RequiredReasonField value={reason} onChange={setReason} />
          </Box>
        )}
      </ConfirmDialog>
    </Box>
  );
};
