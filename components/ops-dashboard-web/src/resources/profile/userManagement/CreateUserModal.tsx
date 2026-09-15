// components/ops-dashboard-web/src/resources/profile/userManagement/CreateUserModal.tsx
import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Box,
  Typography,
  Alert,
  Paper,
  Divider,
} from '@mui/material';
import { UserPlus, Copy, Check, ShieldCheck, Lock, AlertCircle } from 'lucide-react';
import { httpClient } from '../../../dataProvider/httpClient.js';
import { ENDPOINTS } from '../../../dataProvider/endpoints.js';
import { tokens } from '@scatterid/design-tokens';

interface CreateUserModalProps {
  open: boolean;
  onClose: () => void;
  onUserCreated: () => void;
}

export const CreateUserModal: React.FC<CreateUserModalProps> = ({
  open,
  onClose,
  onUserCreated,
}) => {
  const [username, setUsername] = useState<string>('');
  const [role, setRole] = useState<'clerk' | 'mod' | 'root'>('clerk');
  const [stationId, setStationId] = useState<string>('COUNTER-DESK-02');
  const [customPassword, setCustomPassword] = useState<string>('');
  const [useAutoPass, setUseAutoPass] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [createdResult, setCreatedResult] = useState<{
    username: string;
    role: string;
    tempPass: string;
  } | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const resetForm = () => {
    setUsername('');
    setRole('clerk');
    setStationId('COUNTER-DESK-02');
    setCustomPassword('');
    setUseAutoPass(true);
    setError(null);
    setCreatedResult(null);
    setCopied(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('Username is required');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const payload: any = {
        username: username.trim().toLowerCase(),
        role,
        station_id: role === 'clerk' ? stationId.trim() : null,
      };

      if (!useAutoPass && customPassword.trim()) {
        payload.temporary_password = customPassword.trim();
      }

      const res = await httpClient(ENDPOINTS.auth.users, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setCreatedResult({
        username: res.user?.username || username.trim(),
        role: res.user?.role || role,
        tempPass: res.temporary_password,
      });

      onUserCreated();
    } catch (err: any) {
      setError(err.message || 'Failed to provision account');
    } finally {
      setSubmitting(false);
    }
  };

  const copyCredentials = () => {
    if (!createdResult) return;
    const text = `ScatterID Staff Credentials:\nUsername: ${createdResult.username}\nRole: ${createdResult.role}\nTemporary Password: ${createdResult.tempPass}\n\nNote: You will be required to change your password and set up Two-Factor Authentication (TOTP) on first login.`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1 }}>
        <UserPlus size={22} color={tokens.color.brand500} />
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800, color: tokens.color.textMain }}>
            Provision New Staff Account
          </Typography>
          <Typography variant="caption" sx={{ color: tokens.color.textDim }}>
            Role-Based Access Governance & Onboarding Control
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2.5, backgroundColor: tokens.color.bgCard }}>
            {error}
          </Alert>
        )}

        {createdResult ? (
          <Box sx={{ py: 1 }}>
            <Alert severity="success" sx={{ mb: 2.5, backgroundColor: 'rgba(16, 185, 129, 0.1)', color: tokens.color.approve }}>
              Account successfully provisioned! Deliver temporary credentials securely to the operator.
            </Alert>

            <Paper
              variant="outlined"
              sx={{
                p: 2.5,
                backgroundColor: tokens.color.bgCard,
                borderColor: tokens.color.brand500,
                borderRadius: 2,
                mb: 2.5,
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: tokens.color.textMain }}>
                  Temporary Staff Credentials
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={copied ? <Check size={14} color={tokens.color.approve} /> : <Copy size={14} />}
                  onClick={copyCredentials}
                  sx={{ borderColor: tokens.color.borderSubtle, color: tokens.color.textMain }}
                >
                  {copied ? 'Copied to Clipboard' : 'Copy Credentials'}
                </Button>
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, fontFamily: tokens.font.mono, fontSize: '0.85rem' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="caption" sx={{ color: tokens.color.textDim }}>Username:</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: tokens.color.brand700 }}>
                    {createdResult.username}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="caption" sx={{ color: tokens.color.textDim }}>Assigned Role:</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, textTransform: 'uppercase', color: tokens.color.textMain }}>
                    {createdResult.role}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="caption" sx={{ color: tokens.color.textDim }}>Temporary OTP Password:</Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 800,
                      backgroundColor: tokens.color.bgBase,
                      px: 1.5,
                      py: 0.5,
                      borderRadius: 1,
                      border: 1,
                      borderColor: tokens.color.borderSubtle,
                      color: tokens.color.reject,
                    }}
                  >
                    {createdResult.tempPass}
                  </Typography>
                </Box>
              </Box>
            </Paper>

            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, p: 2, backgroundColor: tokens.color.bgBase, borderRadius: 1.5, border: 1, borderColor: tokens.color.borderSubtle }}>
              <ShieldCheck size={18} color={tokens.color.brand500} style={{ flexShrink: 0, marginTop: 2 }} />
              <Typography variant="caption" sx={{ color: tokens.color.textDim, lineHeight: 1.5 }}>
                <strong>Mandatory First-Login Policy:</strong> The operator cannot access queues until they sign in with this temporary password, specify their permanent password, and link their TOTP authenticator device.
              </Typography>
            </Box>
          </Box>
        ) : (
          <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
            {/* Username */}
            <TextField
              fullWidth
              size="small"
              label="Staff Username"
              placeholder="e.g. clerk_alex, mod_danielle"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              helperText="Unique identifier used for authentication and immutable audit attribution."
            />

            {/* Role Selector */}
            <TextField
              select
              fullWidth
              size="small"
              label="Operational Role"
              value={role}
              onChange={e => setRole(e.target.value as any)}
            >
              <MenuItem value="clerk">
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>Desk Clerk (clerk)</Typography>
                  <Typography variant="caption" sx={{ color: tokens.color.textDim }}>Intake counter staff; creates verification and revocation requests.</Typography>
                </Box>
              </MenuItem>
              <MenuItem value="mod">
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>Moderator (mod)</Typography>
                  <Typography variant="caption" sx={{ color: tokens.color.textDim }}>Reviews claimant evidence; approves standard requests or flags anomalies.</Typography>
                </Box>
              </MenuItem>
              <MenuItem value="root">
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>Subordinate Root Administrator (root)</Typography>
                  <Typography variant="caption" sx={{ color: tokens.color.textDim }}>High-trust operator; authorizes gated items, key rotation, and policy governance.</Typography>
                </Box>
              </MenuItem>
            </TextField>

            {/* Desk Station ID (Only for Clerks) */}
            {role === 'clerk' && (
              <TextField
                fullWidth
                size="small"
                label="Assigned Counter Desk / Station ID"
                value={stationId}
                onChange={e => setStationId(e.target.value)}
                helperText="Physical desk identifier attached to in-person identity verification records."
              />
            )}

            {/* Password generation */}
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: tokens.color.textMain }}>
                  Temporary Password Issuance
                </Typography>
                <Button
                  size="small"
                  onClick={() => setUseAutoPass(!useAutoPass)}
                  sx={{ textTransform: 'none', fontSize: '0.75rem', color: tokens.color.brand700 }}
                >
                  {useAutoPass ? 'Specify Custom Initial Password' : 'Use Auto-Generated High-Entropy Password'}
                </Button>
              </Box>

              {!useAutoPass ? (
                <TextField
                  fullWidth
                  size="small"
                  type="password"
                  label="Custom Initial Password"
                  placeholder="Minimum 8 characters"
                  value={customPassword}
                  onChange={e => setCustomPassword(e.target.value)}
                  required
                />
              ) : (
                <Paper variant="outlined" sx={{ p: 1.5, backgroundColor: tokens.color.bgBase, borderColor: tokens.color.borderSubtle }}>
                  <Typography variant="caption" sx={{ color: tokens.color.textDim, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Lock size={14} color={tokens.color.brand500} />
                    A cryptographically random 16-character temporary password will be generated and shown after submission.
                  </Typography>
                </Paper>
              )}
            </Box>

            {/* Governance Policy Box */}
            <Box sx={{ p: 2, backgroundColor: tokens.color.bgBase, borderRadius: 1.5, border: 1, borderColor: tokens.color.borderSubtle }}>
              <Typography variant="caption" sx={{ fontWeight: 800, color: tokens.color.textMain, display: 'block', mb: 0.5 }}>
                ACCOUNT GOVERNANCE POLICIES:
              </Typography>
              <Typography variant="caption" sx={{ color: tokens.color.textDim, display: 'block', mb: 0.5 }}>
                • <strong>Separation of Duty:</strong> Subordinate staff accounts receive only the minimal privilege set required for their job function.
              </Typography>
              <Typography variant="caption" sx={{ color: tokens.color.textDim, display: 'block', mb: 0.5 }}>
                • <strong>Password Storage:</strong> All passwords are salted with 16 random bytes and hashed using Argon2id. Plaintext is never stored.
              </Typography>
              <Typography variant="caption" sx={{ color: tokens.color.textDim, display: 'block' }}>
                • <strong>Master Root Isolation:</strong> Subordinate accounts cannot delete or demote the genesis Master Root (<code>root_admin</code>).
              </Typography>
            </Box>

            <DialogActions sx={{ px: 0, pb: 0, pt: 1 }}>
              <Button onClick={handleClose} disabled={submitting} color="inherit">
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={submitting}
                startIcon={<UserPlus size={16} />}
                sx={{
                  backgroundColor: tokens.color.brand500,
                  color: '#ffffff !important',
                  fontWeight: 700,
                  '&:hover': { backgroundColor: tokens.color.brand700 },
                }}
              >
                {submitting ? 'Provisioning Account...' : 'Provision Staff Account'}
              </Button>
            </DialogActions>
          </Box>
        )}
      </DialogContent>

      {createdResult && (
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button
            onClick={handleClose}
            variant="contained"
            sx={{
              backgroundColor: tokens.color.brand500,
              color: '#ffffff !important',
              fontWeight: 700,
              '&:hover': { backgroundColor: tokens.color.brand700 },
            }}
          >
            Done
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
};
