// components/ops-dashboard-web/src/resources/keyRotation/emergency/EmergencyRotationTab.tsx
import React, { useState } from 'react';
import { Box, Typography, Paper, TextField, Button, Alert } from '@mui/material';
import { ShieldAlert, AlertTriangle } from 'lucide-react';
import { CatastrophicToggle } from './CatastrophicToggle.js';
import { TypedConfirmInput } from './TypedConfirmInput.js';
import { httpClient } from '../../../dataProvider/httpClient.js';
import { ENDPOINTS } from '../../../dataProvider/endpoints.js';
import { useCurrentUser } from '../../../hooks/useCurrentUser.js';
import { tokens } from '@scatterid/design-tokens';

export const EmergencyRotationTab: React.FC = () => {
  const { isRoot } = useCurrentUser();
  const [catastrophic, setCatastrophic] = useState<boolean>(false);
  const [endorsingKeyId, setEndorsingKeyId] = useState<string>('pqc-mldsa87-prod-v1');
  const [delegatedKeyId, setDelegatedKeyId] = useState<string>('');
  const [delegatedPubKeyHex, setDelegatedPubKeyHex] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [confirmText, setConfirmText] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [resultToken, setResultToken] = useState<any | null>(null);

  if (!isRoot) {
    return (
      <Alert severity="error" sx={{ backgroundColor: tokens.color.bgCard, color: tokens.color.textMain }}>
        Emergency key delegation and compromise response are restricted exclusively to Root Administrators.
      </Alert>
    );
  }

  const handleCreateDelegation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!delegatedKeyId || !delegatedPubKeyHex || !reason) {
      setError('All fields including justification reason are required');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const res = await httpClient(ENDPOINTS.keys.delegationCreate, {
        method: 'POST',
        body: JSON.stringify({
          endorsing_key_id: endorsingKeyId,
          delegated_key_id: delegatedKeyId,
          delegated_public_key_hex: delegatedPubKeyHex,
          reason,
          valid_from: new Date().toISOString(),
          valid_until: new Date(Date.now() + 86400000 * 7).toISOString(),
        }),
      });
      setResultToken(res.endorsement || res);
    } catch (err: any) {
      setError(err.message || 'Failed to issue emergency delegation token');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, color: tokens.color.reject, display: 'flex', alignItems: 'center', gap: 1 }}>
          <ShieldAlert size={20} /> Emergency Key Fallback & Cryptographic Delegation
        </Typography>
        <Typography variant="body2" sx={{ color: tokens.color.textDim }}>
          Generate cryptographic delegation tokens to bind a fallback key during disaster recovery or key compromise.
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2, backgroundColor: tokens.color.bgCard }}>{error}</Alert>}

      <Paper variant="outlined" sx={{ p: 3, backgroundColor: tokens.color.bgCard, borderColor: tokens.color.borderSubtle, mb: 3 }}>
        <Box component="form" onSubmit={handleCreateDelegation} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <CatastrophicToggle checked={catastrophic} onChange={setCatastrophic} />

          <TextField
            fullWidth
            size="small"
            label="Endorsing Key ID (Compromised or Active)"
            value={endorsingKeyId}
            onChange={e => setEndorsingKeyId(e.target.value)}
          />

          <TextField
            fullWidth
            size="small"
            label="Delegated Fallback Key ID"
            placeholder="e.g. pqc-mldsa87-fallback-01"
            value={delegatedKeyId}
            onChange={e => setDelegatedKeyId(e.target.value)}
          />

          <TextField
            fullWidth
            size="small"
            multiline
            minRows={2}
            label="Delegated Public Key (Hexadecimal)"
            placeholder="0123456789abcdef..."
            value={delegatedPubKeyHex}
            onChange={e => setDelegatedPubKeyHex(e.target.value)}
          />

          <TextField
            fullWidth
            size="small"
            multiline
            minRows={2}
            required
            label="Emergency Justification Reason (Mandatory)"
            placeholder="Document incident ticket ID and nature of emergency..."
            value={reason}
            onChange={e => setReason(e.target.value)}
          />

          <TypedConfirmInput
            requiredText="EMERGENCY_DELEGATE"
            value={confirmText}
            onChange={setConfirmText}
          />

          <Button
            type="submit"
            variant="contained"
            color="error"
            disabled={submitting || confirmText !== 'EMERGENCY_DELEGATE'}
            sx={{ backgroundColor: tokens.color.reject, color: '#ffffff', alignSelf: 'flex-start', '&:hover': { backgroundColor: tokens.color.reject } }}
          >
            Issue Emergency Delegation Token
          </Button>
        </Box>
      </Paper>

      {resultToken && (
        <Paper variant="outlined" sx={{ p: 3, backgroundColor: tokens.color.bgSurface, borderColor: tokens.color.approve }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: tokens.color.approve, mb: 1 }}>
            Cryptographic Delegation Token Generated
          </Typography>
          <Box
            component="pre"
            sx={{
              p: 2,
              borderRadius: 1,
              backgroundColor: tokens.color.bgBase,
              fontFamily: tokens.font.mono,
              fontSize: '0.75rem',
              color: tokens.color.brand300,
              overflowX: 'auto',
            }}
          >
            {JSON.stringify(resultToken, null, 2)}
          </Box>
        </Paper>
      )}
    </Box>
  );
};
