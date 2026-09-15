// components/ops-dashboard-web/src/resources/keyRotation/coldBackup/ExportBackupForm.tsx
import React, { useState } from 'react';
import { Box, Button, TextField, Typography, Alert, Paper } from '@mui/material';
import { Download } from 'lucide-react';
import { httpClient } from '../../../dataProvider/httpClient.js';
import { ENDPOINTS } from '../../../dataProvider/endpoints.js';
import { tokens } from '@scatterid/design-tokens';

export const ExportBackupForm: React.FC = () => {
  const [passphrase, setPassphrase] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [exportedData, setExportedData] = useState<string | null>(null);

  const handleExport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passphrase || passphrase.length < 8) {
      setError('Passphrase must be at least 8 characters');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const res = await httpClient(ENDPOINTS.keys.exportBackup, {
        method: 'POST',
        body: JSON.stringify({ encryption_passphrase: passphrase }),
      });
      setExportedData(res.backup_payload || res.encryptedEnvelope || JSON.stringify(res));
      setPassphrase('');
    } catch (err: any) {
      setError(err.message || 'Backup export failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: 3, backgroundColor: tokens.color.bgCard, borderColor: tokens.color.borderSubtle }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, color: tokens.color.textMain, mb: 1 }}>
        Export Encrypted Cold Backup (.enc)
      </Typography>
      <Typography variant="body2" sx={{ color: tokens.color.textDim, mb: 2 }}>
        Creates an AES-256-GCM encrypted envelope containing key material for offline cold storage.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2, backgroundColor: tokens.color.bgSurface }}>{error}</Alert>}

      <Box component="form" onSubmit={handleExport} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          type="password"
          fullWidth
          size="small"
          label="Encryption Passphrase"
          placeholder="Enter high-entropy passphrase..."
          value={passphrase}
          onChange={e => setPassphrase(e.target.value)}
        />

        <Button
          type="submit"
          variant="contained"
          disabled={submitting}
          startIcon={<Download size={16} />}
          sx={{ backgroundColor: tokens.color.brand500, color: '#ffffff', alignSelf: 'flex-start' }}
        >
          Export Backup Envelope
        </Button>
      </Box>

      {exportedData && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="caption" sx={{ color: tokens.color.approve, fontWeight: 700, display: 'block', mb: 1 }}>
            Encrypted Backup Generated:
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
              maxHeight: 180,
            }}
          >
            {exportedData}
          </Box>
        </Box>
      )}
    </Paper>
  );
};
