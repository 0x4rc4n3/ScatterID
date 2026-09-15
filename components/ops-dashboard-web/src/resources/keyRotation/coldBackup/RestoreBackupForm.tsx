// components/ops-dashboard-web/src/resources/keyRotation/coldBackup/RestoreBackupForm.tsx
import React, { useState } from 'react';
import { Box, Button, TextField, Typography, Alert, Paper } from '@mui/material';
import { UploadCloud } from 'lucide-react';
import { httpClient } from '../../../dataProvider/httpClient.js';
import { ENDPOINTS } from '../../../dataProvider/endpoints.js';
import { tokens } from '@scatterid/design-tokens';

export const RestoreBackupForm: React.FC = () => {
  const [payload, setPayload] = useState<string>('');
  const [passphrase, setPassphrase] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payload.trim() || !passphrase) {
      setError('Both encrypted backup payload and passphrase are required');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const res = await httpClient(ENDPOINTS.keys.restoreBackup, {
        method: 'POST',
        body: JSON.stringify({
          encrypted_payload_base64: payload.trim(),
          decryption_passphrase: passphrase,
        }),
      });
      setSuccess(res.message || 'Key backup successfully decrypted and restored into pool');
      setPayload('');
      setPassphrase('');
    } catch (err: any) {
      setError(err.message || 'Failed to restore backup');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: 3, backgroundColor: tokens.color.bgCard, borderColor: tokens.color.borderSubtle }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, color: tokens.color.textMain, mb: 1 }}>
        Restore Cold Backup Envelope
      </Typography>
      <Typography variant="body2" sx={{ color: tokens.color.textDim, mb: 2 }}>
        Decrypts an AES-256-GCM envelope and reinstates historical keying material into active memory.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2, backgroundColor: tokens.color.bgSurface }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2, backgroundColor: tokens.color.bgSurface }}>{success}</Alert>}

      <Box component="form" onSubmit={handleRestore} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          multiline
          minRows={3}
          fullWidth
          size="small"
          label="Encrypted Payload (Base64)"
          value={payload}
          onChange={e => setPayload(e.target.value)}
        />

        <TextField
          type="password"
          fullWidth
          size="small"
          label="Decryption Passphrase"
          value={passphrase}
          onChange={e => setPassphrase(e.target.value)}
        />

        <Button
          type="submit"
          variant="contained"
          disabled={submitting}
          startIcon={<UploadCloud size={16} />}
          sx={{ backgroundColor: tokens.color.brand500, color: '#ffffff', alignSelf: 'flex-start' }}
        >
          Restore Key Material
        </Button>
      </Box>
    </Paper>
  );
};
