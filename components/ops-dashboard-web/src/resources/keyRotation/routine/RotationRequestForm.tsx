// components/ops-dashboard-web/src/resources/keyRotation/routine/RotationRequestForm.tsx
import React, { useState } from 'react';
import { Box, Button, TextField, Typography, Alert, Paper, MenuItem } from '@mui/material';
import { ArrowUpRight } from 'lucide-react';
import { httpClient } from '../../../dataProvider/httpClient.js';
import { ENDPOINTS } from '../../../dataProvider/endpoints.js';
import { tokens } from '@scatterid/design-tokens';

interface RotationRequestFormProps {
  preStagedKeys: any[];
  onComplete: () => void;
}

export const RotationRequestForm: React.FC<RotationRequestFormProps> = ({
  preStagedKeys,
  onComplete,
}) => {
  const [selectedKeyId, setSelectedKeyId] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handlePromote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedKeyId) {
      setError('Please select a pre-staged key to promote');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await httpClient(ENDPOINTS.keys.pqcPromote, {
        method: 'POST',
        body: JSON.stringify({ key_id: selectedKeyId, reason: reason.trim() || 'Scheduled advance promotion' }),
      });
      setSuccess(`Key ${selectedKeyId} successfully promoted to active signing key!`);
      setSelectedKeyId('');
      setReason('');
      onComplete();
    } catch (err: any) {
      setError(err.message || 'Failed to promote key');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: 3, backgroundColor: tokens.color.bgCard, borderColor: tokens.color.borderSubtle }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, color: tokens.color.textMain, mb: 1 }}>
        Promote Pre-Staged PQC Key (Advance Rotation)
      </Typography>
      <Typography variant="body2" sx={{ color: tokens.color.textDim, mb: 2 }}>
        Promoting seamlessly transitions signing authority to the selected pre-distributed ML-DSA-87 key with zero verification downtime.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2, backgroundColor: tokens.color.bgSurface }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2, backgroundColor: tokens.color.bgSurface }}>{success}</Alert>}

      <Box component="form" onSubmit={handlePromote} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          select
          fullWidth
          size="small"
          label="Select Pre-Staged Key"
          value={selectedKeyId}
          onChange={e => setSelectedKeyId(e.target.value)}
          InputLabelProps={{ shrink: true }}
          SelectProps={{
            displayEmpty: true,
          }}
        >
          <MenuItem value="" disabled>
            <em>{preStagedKeys.length === 0 ? 'No pre-staged keys available (Pre-stage one below)' : '-- Choose Key From Pool --'}</em>
          </MenuItem>
          {preStagedKeys.map(k => (
            <MenuItem key={k.key_id} value={k.key_id}>
              {k.key_id} (Seq: {k.sequence_number}, Algo: {k.algorithm})
            </MenuItem>
          ))}
        </TextField>

        <TextField
          fullWidth
          size="small"
          label="Rotation Justification"
          placeholder="e.g. Scheduled quarterly rotation cycle"
          value={reason}
          onChange={e => setReason(e.target.value)}
        />

        <Button
          type="submit"
          variant="contained"
          disabled={submitting || preStagedKeys.length === 0}
          startIcon={<ArrowUpRight size={16} />}
          sx={{ backgroundColor: tokens.color.brand500, color: '#ffffff', alignSelf: 'flex-start' }}
        >
          Promote to Active
        </Button>
      </Box>
    </Paper>
  );
};
