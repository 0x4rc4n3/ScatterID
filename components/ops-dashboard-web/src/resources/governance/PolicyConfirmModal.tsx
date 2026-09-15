// components/ops-dashboard-web/src/resources/governance/PolicyConfirmModal.tsx
import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
  Alert,
  Paper,
  Divider,
} from '@mui/material';
import { ShieldAlert, KeyRound } from 'lucide-react';
import { tokens } from '@scatterid/design-tokens';

interface PolicyConfirmModalProps {
  open: boolean;
  targetProfileKey: string | null;
  targetProfileName: string;
  targetDescription: string;
  onConfirm: (totpCode: string) => Promise<void>;
  onClose: () => void;
  submitting: boolean;
}

export const PolicyConfirmModal: React.FC<PolicyConfirmModalProps> = ({
  open,
  targetProfileKey,
  targetProfileName,
  targetDescription,
  onConfirm,
  onClose,
  submitting,
}) => {
  const [totpCode, setTotpCode] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  if (!open || !targetProfileKey) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!totpCode || totpCode.trim().length < 6) {
      setError('Please enter a valid 6-digit Root Authenticator (TOTP) code.');
      return;
    }
    try {
      setError(null);
      await onConfirm(totpCode.trim());
      setTotpCode('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Policy authorization failed');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ShieldAlert size={22} color={tokens.color.rootTier} />
          <Typography variant="h6" sx={{ fontWeight: 800, color: tokens.color.textMain }}>
            Authorize Governance Policy Change
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        <Typography variant="body2" sx={{ color: tokens.color.textDim, mb: 2 }}>
          Altering the operational risk policy affects automated ledger execution and approval tiers across all counters and verification nodes.
        </Typography>

        <Paper
          variant="outlined"
          sx={{
            p: 2,
            mb: 2.5,
            backgroundColor: 'rgba(168, 85, 247, 0.08)',
            borderColor: 'rgba(168, 85, 247, 0.3)',
            borderRadius: 1.5,
          }}
        >
          <Typography variant="caption" sx={{ color: tokens.color.rootTier, fontWeight: 700 }}>
            TARGET ORGANIZATIONAL POSTURE:
          </Typography>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, color: tokens.color.textMain }}>
            {targetProfileName} ({targetProfileKey})
          </Typography>
          <Typography variant="body2" sx={{ color: tokens.color.textDim, mt: 0.5 }}>
            {targetDescription}
          </Typography>
        </Paper>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box>
            <Typography variant="caption" sx={{ color: tokens.color.textDim, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
              <KeyRound size={14} /> Root Multi-Factor Verification Code (TOTP) *
            </Typography>
            <TextField
              fullWidth
              size="small"
              placeholder="e.g. 123456"
              value={totpCode}
              onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputProps={{ maxLength: 6, style: { fontFamily: tokens.font.mono, letterSpacing: '0.2em', fontSize: '1.1rem', fontWeight: 700 } }}
              required
              helperText="Enter 6-digit code from your Root Authenticator app (e.g. Google Authenticator, 1Password)"
            />
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={submitting} color="inherit">
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={submitting || totpCode.trim().length < 6}
          sx={{
            backgroundColor: tokens.color.rootTier,
            color: '#ffffff',
            fontWeight: 700,
            '&:hover': { backgroundColor: tokens.color.brand700 },
          }}
        >
          {submitting ? 'Verifying...' : 'Authorize & Apply Policy'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
