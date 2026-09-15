// components/ops-dashboard-web/src/resources/profile/userManagement/ResetPasswordModal.tsx
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
  IconButton,
  InputAdornment,
} from '@mui/material';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import { httpClient } from '../../../dataProvider/httpClient.js';
import { ENDPOINTS } from '../../../dataProvider/endpoints.js';
import { useCanAccess } from 'react-admin';
import { tokens } from '@scatterid/design-tokens';

interface ResetPasswordModalProps {
  open: boolean;
  targetUser: any | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({
  open,
  targetUser,
  onClose,
  onSuccess,
}) => {
  const { canAccess: canResetAll } = useCanAccess({ resource: 'userManagement', action: 'reset-password-all' });
  const { canAccess: canResetClerk } = useCanAccess({ resource: 'userManagement', action: 'reset-password-clerk' });
  const [newPassword, setNewPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [reason, setReason] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
    let pass = '';
    for (let i = 0; i < 14; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(pass);
    setShowPassword(true);
  };

  if (!targetUser) return null;

  // Enforce client-side role gating per §6: Mod can ONLY reset clerks; Root can reset all
  const canResetThisUser = canResetAll || (canResetClerk && targetUser.role === 'clerk');

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canResetThisUser) {
      setError('Permission denied: Moderators may only reset Help Desk Clerk accounts.');
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      setError('Temporary password must be at least 8 characters');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await httpClient(ENDPOINTS.auth.resetPassword, {
        method: 'POST',
        body: JSON.stringify({
          target_username: targetUser.username,
          new_password: newPassword,
          reason: reason || 'Administrative credential reset',
        }),
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Password reset failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Reset Staff Password</DialogTitle>
      <DialogContent>
        {!canResetThisUser ? (
          <Alert severity="error" sx={{ mt: 1 }}>
            Access Denied: Moderators are strictly restricted to resetting counter clerk passwords.
          </Alert>
        ) : (
          <Box component="form" onSubmit={handleReset} sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <Typography variant="body2" sx={{ color: tokens.color.textDim }}>
              Resetting credentials for staff user <Typography component="span" sx={{ fontWeight: 700, color: tokens.color.brand300 }}>{targetUser.username}</Typography> ({targetUser.role.toUpperCase()}).
            </Typography>
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                <Typography variant="caption" sx={{ color: tokens.color.textDim, fontWeight: 600 }}>
                  Temporary Password *
                </Typography>
                <Button
                  size="small"
                  variant="text"
                  startIcon={<KeyRound size={12} />}
                  onClick={generateRandomPassword}
                  sx={{ textTransform: 'none', fontSize: '0.75rem', py: 0, color: tokens.color.brand500, fontWeight: 600 }}
                >
                  ⚡ Generate Secure Temp Pass
                </Button>
              </Box>
              <TextField
                type={showPassword ? 'text' : 'password'}
                fullWidth
                size="small"
                placeholder="Enter or generate temporary password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle password visibility"
                        onClick={() => setShowPassword(v => !v)}
                        edge="end"
                        size="small"
                        title={showPassword ? 'Hide password' : 'Show password'}
                        sx={{ color: tokens.color.textDim }}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
            <TextField
              fullWidth
              size="small"
              label="Administrative Reason (Mandatory)"
              placeholder="e.g. Lost device, rotation policy"
              value={reason}
              onChange={e => setReason(e.target.value)}
              required
            />
            <Button
              type="submit"
              variant="contained"
              disabled={submitting}
              sx={{ backgroundColor: tokens.color.brand500, color: '#ffffff' }}
            >
              Confirm Password Reset
            </Button>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">Cancel</Button>
      </DialogActions>
    </Dialog>
  );
};
