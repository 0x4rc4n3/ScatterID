// components/ops-dashboard-web/src/resources/keyRotation/gatewayKeys/GatewayKeysTab.tsx
import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, Grid, Button, Chip, Alert } from '@mui/material';
import { Key, RefreshCw, RotateCcw } from 'lucide-react';
import { httpClient } from '../../../dataProvider/httpClient.js';
import { ENDPOINTS } from '../../../dataProvider/endpoints.js';
import { GraceWindowModal } from './GraceWindowModal.js';
import { useCurrentUser } from '../../../hooks/useCurrentUser.js';
import { tokens } from '@scatterid/design-tokens';

export const GatewayKeysTab: React.FC = () => {
  const { isRoot } = useCurrentUser();
  const [verifyKeyStatus, setVerifyKeyStatus] = useState<any>(null);
  const [revokeKeyStatus, setRevokeKeyStatus] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [rotatingKeyName, setRotatingKeyName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);

  const fetchStatuses = async () => {
    try {
      setLoading(true);
      const [vStatus, rStatus] = await Promise.all([
        httpClient(ENDPOINTS.keys.gatewayStatus('VERIFICATION_API_KEY')),
        httpClient(ENDPOINTS.keys.gatewayStatus('REVOKE_API_KEY')),
      ]);
      setVerifyKeyStatus(vStatus);
      setRevokeKeyStatus(rStatus);
    } catch (err) {
      console.error('Failed to load gateway key statuses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatuses();
  }, []);

  const handleRotate = async (graceHours: number) => {
    if (!rotatingKeyName) return;
    try {
      setSubmitting(true);
      setFeedback(null);
      await httpClient(ENDPOINTS.keys.gatewayRotate, {
        method: 'POST',
        body: JSON.stringify({ key_name: rotatingKeyName, grace_window_hours: graceHours }),
      });
      setFeedback({ message: `Successfully rotated ${rotatingKeyName} with ${graceHours}h grace window`, severity: 'success' });
      setRotatingKeyName(null);
      fetchStatuses();
    } catch (err: any) {
      setFeedback({ message: err.message || 'Rotation failed', severity: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const renderKeyCard = (title: string, keyName: string, status: any) => (
    <Paper variant="outlined" sx={{ p: 3, backgroundColor: tokens.color.bgCard, borderColor: tokens.color.borderSubtle }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Key size={18} color={tokens.color.cyanMid} />
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: tokens.color.textMain }}>
            {title}
          </Typography>
        </Box>
        <Chip
          size="small"
          label={status?.status || (status?.active ? 'ACTIVE' : 'READY')}
          sx={{ backgroundColor: tokens.color.approve, color: '#ffffff', fontWeight: 700 }}
        />
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 3 }}>
        <Typography variant="caption" sx={{ color: tokens.color.textDim }}>Parameter Name:</Typography>
        <Typography variant="body2" sx={{ fontFamily: tokens.font.mono, color: tokens.color.brand300 }}>
          {keyName}
        </Typography>
        {status?.activeKeyId && (
          <>
            <Typography variant="caption" sx={{ color: tokens.color.textDim }}>Active Key Identifier:</Typography>
            <Typography variant="caption" sx={{ fontFamily: tokens.font.mono, color: tokens.color.textMain }}>
              {status.activeKeyId}
            </Typography>
          </>
        )}
      </Box>

      {isRoot && (
        <Button
          size="small"
          variant="contained"
          startIcon={<RotateCcw size={14} />}
          onClick={() => setRotatingKeyName(keyName)}
          sx={{ backgroundColor: tokens.color.brand500, color: '#ffffff' }}
        >
          Rotate Key
        </Button>
      )}
    </Paper>
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800, color: tokens.color.textMain }}>
            Gateway Dual-Key Zero-Downtime Management
          </Typography>
          <Typography variant="body2" sx={{ color: tokens.color.textDim }}>
            Manage API gateway tokens with rolling overlap windows for continuous client availability
          </Typography>
        </Box>
        <Button
          size="small"
          variant="outlined"
          startIcon={<RefreshCw size={14} className={loading ? 'animate-spin' : ''} />}
          onClick={fetchStatuses}
          disabled={loading}
          sx={{ borderColor: tokens.color.borderSubtle, color: tokens.color.textMain }}
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </Button>
      </Box>

      {feedback && (
        <Alert severity={feedback.severity} sx={{ mb: 2, backgroundColor: tokens.color.bgCard }}>
          {feedback.message}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          {renderKeyCard('Verification Gateway API Key', 'VERIFICATION_API_KEY', verifyKeyStatus)}
        </Grid>
        <Grid item xs={12} md={6}>
          {renderKeyCard('Revocation Gateway API Key', 'REVOKE_API_KEY', revokeKeyStatus)}
        </Grid>
      </Grid>

      <GraceWindowModal
        open={Boolean(rotatingKeyName)}
        keyName={rotatingKeyName || ''}
        onConfirm={handleRotate}
        onCancel={() => setRotatingKeyName(null)}
        submitting={submitting}
      />
    </Box>
  );
};
