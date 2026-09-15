// components/ops-dashboard-web/src/components/shared/PermissionErrorScreen.tsx
import React from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import { ShieldAlert } from 'lucide-react';
import { tokens } from '@scatterid/design-tokens';

interface PermissionErrorScreenProps {
  resourceName?: string;
  requiredRole?: string;
}

export const PermissionErrorScreen: React.FC<PermissionErrorScreenProps> = ({
  resourceName = 'this resource',
  requiredRole = 'Root Administrator',
}) => {
  return (
    <Box sx={{ p: 4, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <Paper
        variant="outlined"
        sx={{
          p: 5,
          maxWidth: 500,
          textAlign: 'center',
          borderColor: tokens.color.reject,
          backgroundColor: tokens.color.bgCard,
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2, color: tokens.color.reject }}>
          <ShieldAlert size={48} />
        </Box>
        <Typography variant="h5" sx={{ fontWeight: 700, color: tokens.color.textMain, mb: 1 }}>
          Access Denied
        </Typography>
        <Typography variant="body2" sx={{ color: tokens.color.textDim, mb: 3 }}>
          Structural privilege separation restricts access to {resourceName}. This operation requires {requiredRole} privileges.
        </Typography>
        <Button variant="outlined" color="inherit" onClick={() => window.history.back()}>
          Return to Previous Screen
        </Button>
      </Paper>
    </Box>
  );
};
