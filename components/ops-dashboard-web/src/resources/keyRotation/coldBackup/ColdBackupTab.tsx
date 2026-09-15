// components/ops-dashboard-web/src/resources/keyRotation/coldBackup/ColdBackupTab.tsx
import React from 'react';
import { Box, Typography, Grid, Alert } from '@mui/material';
import { Archive } from 'lucide-react';
import { ExportBackupForm } from './ExportBackupForm.js';
import { RestoreBackupForm } from './RestoreBackupForm.js';
import { useCurrentUser } from '../../../hooks/useCurrentUser.js';
import { tokens } from '@scatterid/design-tokens';

export const ColdBackupTab: React.FC = () => {
  const { isRoot } = useCurrentUser();

  if (!isRoot) {
    return (
      <Alert severity="error" sx={{ backgroundColor: tokens.color.bgCard, color: tokens.color.textMain }}>
        Cold backup operations require Root Administrator privileges.
      </Alert>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, color: tokens.color.textMain, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Archive size={20} color={tokens.color.brand500} /> Encrypted Cold Backup & Disaster Recovery
        </Typography>
        <Typography variant="body2" sx={{ color: tokens.color.textDim }}>
          Export and restore key material safely across air-gapped security boundaries using AES-256-GCM
        </Typography>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <ExportBackupForm />
        </Grid>
        <Grid item xs={12} md={6}>
          <RestoreBackupForm />
        </Grid>
      </Grid>
    </Box>
  );
};
