// components/ops-dashboard-web/src/resources/profile/TransferMfaModal.tsx
import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Alert,
} from '@mui/material';
import { httpClient } from '../../dataProvider/httpClient.js';
import { ENDPOINTS } from '../../dataProvider/endpoints.js';
import { tokens } from '@scatterid/design-tokens';

interface TransferMfaModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const TransferMfaModal: React.FC<TransferMfaModalProps> = ({
  open,
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState<'init' | 'confirm'>('init');
  const [password, setPassword] = useState<string>('');
  const [totpCode, setTotpCode] = useState<string>('');
  const [transferData, setTransferData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const handleInit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);
      const res = await httpClient(ENDPOINTS.auth.mfaTransferInit, {
        method: 'POST',
        body: JSON.stringify({ password }),
      });
      setTransferData(res);
      setStep('confirm');
      setPassword('');
    } catch (err: any) {
      setError(err.message || 'MFA transfer initiation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);
      await httpClient(ENDPOINTS.auth.mfaTransferConfirm, {
        method: 'POST',
        body: JSON.stringify({
          transferToken: transferData.transferToken,
          totpCode: totpCode.trim(),
        }),
      });
      onSuccess();
      handleClose();
    } catch (err: any) {
      setError(err.message || 'MFA transfer confirmation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setStep('init');
    setPassword('');
    setTotpCode('');
    setTransferData(null);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Transfer MFA Authenticator Device</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {step === 'init' ? (
          <Box component="form" onSubmit={handleInit} sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <Typography variant="body2" sx={{ color: tokens.color.textDim }}>
              To re-enroll or transfer your authenticator app to a new device, re-enter your account password:
            </Typography>
            <TextField
              type="password"
              fullWidth
              size="small"
              label="Account Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
            <Button type="submit" variant="contained" disabled={submitting || !password} sx={{ backgroundColor: tokens.color.brand500, color: '#ffffff' }}>
              Initiate Transfer
            </Button>
          </Box>
        ) : (
          <Box component="form" onSubmit={handleConfirm} sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <Typography variant="body2" sx={{ color: tokens.color.textDim }}>
              Scan the new QR code or enter the secret into your authenticator app, then provide the 6-digit code:
            </Typography>

            {transferData?.qrCodeDataUrl && (
              <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
                <img src={transferData.qrCodeDataUrl} alt="TOTP QR Code" width={180} height={180} />
              </Box>
            )}

            <TextField
              fullWidth
              size="small"
              label="6-Digit Authenticator Code"
              placeholder="000000"
              value={totpCode}
              onChange={e => setTotpCode(e.target.value)}
              required
            />
            <Button type="submit" variant="contained" disabled={submitting || !totpCode} sx={{ backgroundColor: tokens.color.brand500, color: '#ffffff' }}>
              Verify & Complete Transfer
            </Button>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} color="inherit">Close</Button>
      </DialogActions>
    </Dialog>
  );
};
