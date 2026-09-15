// components/ops-dashboard-web/src/auth/LoginPage.tsx
import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert,
  Tabs,
  Tab,
  FormControlLabel,
  Checkbox,
  Paper,
} from '@mui/material';
import { Shield, ArrowLeft } from 'lucide-react';
import { useLogin, useNotify } from 'react-admin';
import { tokens } from '@scatterid/design-tokens';
import { httpClient } from '../dataProvider/httpClient.js';
import { ENDPOINTS } from '../dataProvider/endpoints.js';

export const LoginPage: React.FC = () => {
  const login = useLogin();
  const notify = useNotify();

  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [totpCode, setTotpCode] = useState<string>('');
  const [recoveryCode, setRecoveryCode] = useState<string>('');
  const [mfaTab, setMfaTab] = useState<'totp' | 'recovery'>('totp');
  const [forceOnboarding, setForceOnboarding] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // First-time onboarding state
  const [firstTimeData, setFirstTimeData] = useState<any | null>(null);
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [onboardingTotp, setOnboardingTotp] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please enter both username and password');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await login({
        username,
        password,
        totp_code: mfaTab === 'totp' ? totpCode.trim() : undefined,
        recovery_code: mfaTab === 'recovery' ? recoveryCode.trim() : undefined,
        force_onboarding: forceOnboarding,
      });
    } catch (err: any) {
      if (err.setupRequired && err.setupData) {
        setFirstTimeData(err.setupData);
      } else {
        setError(err.message || 'Authentication failed');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteFirstTimeSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const data = await httpClient(ENDPOINTS.auth.firstTimeSetup, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${firstTimeData.tempToken}`,
        },
        body: JSON.stringify({
          newPassword,
          totpCode: onboardingTotp.trim(),
          totpSecret: firstTimeData.mfaSetup?.secret,
          recoveryCodes: firstTimeData.mfaSetup?.recoveryCodes,
        }),
      });

      if (data && data.token) {
        localStorage.setItem('scatterid_token', data.token);
        if (data.user) {
          localStorage.setItem('scatterid_user', JSON.stringify(data.user));
        }
        notify('First-time onboarding completed successfully! Entering privileged session...', { type: 'success' });
        setTimeout(() => {
          window.location.hash = '#/overview';
          window.location.reload();
        }, 400);
        return;
      }

      notify('First-time setup complete! Please sign in with your permanent credentials.');
      setFirstTimeData(null);
      setPassword('');
      setTotpCode('');
    } catch (err: any) {
      setError(err.message || 'Setup completion failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoLogin = async (role: 'root' | 'mod') => {
    try {
      setSubmitting(true);
      setError(null);
      const res = await fetch(ENDPOINTS.auth.demoLogin, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Demo login failed');
      const user = data.user || data;
      localStorage.setItem('scatterid_token', data.token);
      localStorage.setItem('scatterid_user', JSON.stringify(user));
      notify(`Logged in as ${user?.username || role} (${(user?.role || role).toUpperCase()})`, { type: 'success' });
      window.location.hash = '#/overview';
      window.location.reload();
    } catch (err: any) {
      setError(err.message || 'Demo login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: tokens.color.bgLight,
        p: 2,
      }}
    >
      <Card
        variant="outlined"
        sx={{
          width: '100%',
          maxWidth: firstTimeData ? 520 : 460,
          backgroundColor: tokens.color.white,
          borderColor: tokens.color.borderLight,
          borderRadius: 2,
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.05)',
        }}
      >
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 1.5,
                backgroundColor: tokens.color.brand500,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: tokens.color.white,
              }}
            >
              <Shield size={24} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800, color: tokens.color.slate800, lineHeight: 1.2 }}>
                ScatterID Operations
              </Typography>
              <Typography variant="caption" sx={{ color: tokens.color.brand700, fontWeight: 700 }}>
                High-Assurance Privileged Access & Governance
              </Typography>
            </Box>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2.5, borderRadius: 1.5 }}>
              {error}
            </Alert>
          )}

          {!firstTimeData ? (
            <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                fullWidth
                size="small"
                label="Operator Username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                autoFocus
              />

              <TextField
                fullWidth
                size="small"
                type="password"
                label="Password / Temp Key"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />

              <Tabs
                value={mfaTab}
                onChange={(_, v) => setMfaTab(v)}
                sx={{
                  borderBottom: 1,
                  borderColor: tokens.color.borderLight,
                  '& .MuiTab-root': { fontSize: '0.75rem', fontWeight: 700, minHeight: 36, textTransform: 'none' },
                }}
              >
                <Tab value="totp" label="6-Digit TOTP" />
                <Tab value="recovery" label="Recovery Code" />
              </Tabs>

              {mfaTab === 'totp' ? (
                <TextField
                  fullWidth
                  size="small"
                  label="TOTP Authenticator Code"
                  placeholder="000000 (Dev: 123456)"
                  value={totpCode}
                  onChange={e => setTotpCode(e.target.value)}
                  inputProps={{ maxLength: 6 }}
                  helperText="Optional for development and testing"
                />
              ) : (
                <TextField
                  fullWidth
                  size="small"
                  label="Single-Use Recovery Code"
                  placeholder="XXXX-XXXX"
                  value={recoveryCode}
                  onChange={e => setRecoveryCode(e.target.value)}
                />
              )}

              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pt: 0.5 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      size="small"
                      checked={forceOnboarding}
                      onChange={e => setForceOnboarding(e.target.checked)}
                      sx={{ color: tokens.color.brand500, '&.Mui-checked': { color: tokens.color.brand500 } }}
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: '0.8rem', color: tokens.color.slate700, fontWeight: 600 }}>
                      First-Time Setup / Reset MFA
                    </Typography>
                  }
                />
              </Box>

              <Button
                type="submit"
                variant="contained"
                disabled={submitting}
                sx={{
                  mt: 1,
                  backgroundColor: tokens.color.brand500,
                  color: '#ffffff',
                  fontWeight: 700,
                  py: 1.2,
                  textTransform: 'none',
                  fontSize: '0.9rem',
                  '&:hover': { backgroundColor: tokens.color.brand700 },
                }}
              >
                {submitting ? 'Verifying...' : forceOnboarding ? 'Initialize Onboarding' : 'Authenticate Session'}
              </Button>

              <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: tokens.color.borderLight, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography variant="caption" sx={{ color: tokens.color.slate500, fontWeight: 700, textAlign: 'center' }}>
                  Quick Testing Access (One-Click Dev Login):
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    fullWidth
                    size="small"
                    variant="outlined"
                    onClick={() => handleDemoLogin('root')}
                    disabled={submitting}
                    sx={{ textTransform: 'none', fontSize: '0.75rem', fontWeight: 700, borderColor: tokens.color.brand500, color: tokens.color.brand700 }}
                  >
                    ⚡ Root Admin
                  </Button>
                  <Button
                    fullWidth
                    size="small"
                    variant="outlined"
                    onClick={() => handleDemoLogin('mod')}
                    disabled={submitting}
                    sx={{ textTransform: 'none', fontSize: '0.75rem', fontWeight: 700, borderColor: tokens.color.brand500, color: tokens.color.brand700 }}
                  >
                    ⚡ Moderator
                  </Button>
                </Box>
              </Box>
            </Box>
          ) : (
            <Box component="form" onSubmit={handleCompleteFirstTimeSetup} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: tokens.color.slate800 }}>
                  Privileged Staff Onboarding
                </Typography>
                <Button
                  size="small"
                  startIcon={<ArrowLeft size={14} />}
                  onClick={() => {
                    setFirstTimeData(null);
                    setPassword('');
                  }}
                  sx={{ textTransform: 'none', fontSize: '0.75rem', color: tokens.color.slate500 }}
                >
                  Back to Login
                </Button>
              </Box>

              <Typography variant="body2" sx={{ color: tokens.color.slate500, fontSize: '0.85rem' }}>
                Account: <strong>{firstTimeData.username}</strong> ({firstTimeData.role?.toUpperCase()}). Establish permanent credentials and register your hardware/app TOTP:
              </Typography>

              {firstTimeData.mfaSetup?.qrCodeDataUrl && (
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    p: 2,
                    backgroundColor: tokens.color.slate50,
                    borderRadius: 2,
                    border: `1px solid ${tokens.color.borderLight}`,
                  }}
                >
                  <img src={firstTimeData.mfaSetup.qrCodeDataUrl} alt="TOTP QR Code" width={150} height={150} />
                  <Typography variant="caption" sx={{ mt: 1, color: tokens.color.slate700, fontFamily: tokens.font.mono, fontSize: '0.75rem' }}>
                    Secret: {firstTimeData.mfaSetup.secret}
                  </Typography>
                </Box>
              )}

              {Array.isArray(firstTimeData.mfaSetup?.recoveryCodes) && firstTimeData.mfaSetup.recoveryCodes.length > 0 && (
                <Paper
                  variant="outlined"
                  sx={{
                    p: 1.5,
                    backgroundColor: tokens.color.bgLightCard,
                    borderColor: tokens.color.borderLight,
                    borderRadius: 1.5,
                  }}
                >
                  <Typography variant="caption" sx={{ fontWeight: 700, color: tokens.color.brand700, display: 'block', mb: 0.5 }}>
                    Emergency Recovery Codes (Save Securely):
                  </Typography>
                  <Typography variant="caption" sx={{ fontFamily: tokens.font.mono, color: tokens.color.slate700, display: 'block', wordBreak: 'break-all' }}>
                    {firstTimeData.mfaSetup.recoveryCodes.slice(0, 4).join('  •  ')}
                  </Typography>
                </Paper>
              )}

              <TextField
                type="password"
                fullWidth
                size="small"
                label="New Permanent Password (min 8 chars)"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
              />

              <TextField
                type="password"
                fullWidth
                size="small"
                label="Confirm Permanent Password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
              />

              <TextField
                fullWidth
                size="small"
                label="Confirm TOTP Authenticator Code (Dev: 123456)"
                placeholder="000000"
                value={onboardingTotp}
                onChange={e => setOnboardingTotp(e.target.value)}
                required
              />

              <Button
                type="submit"
                variant="contained"
                disabled={submitting}
                sx={{
                  mt: 1,
                  backgroundColor: tokens.color.brand500,
                  color: '#ffffff',
                  fontWeight: 700,
                  py: 1.2,
                  textTransform: 'none',
                  '&:hover': { backgroundColor: tokens.color.brand700 },
                }}
              >
                {submitting ? 'Saving Credentials...' : 'Complete Onboarding & Enter Session'}
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};
