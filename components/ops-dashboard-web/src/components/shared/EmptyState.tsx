// components/ops-dashboard-web/src/components/shared/EmptyState.tsx
import React from 'react';
import { Box, Typography } from '@mui/material';
import { tokens } from '@scatterid/design-tokens';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  action,
}) => {
  return (
    <Box
      sx={{
        py: 8,
        px: 3,
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: tokens.color.textDim,
      }}
    >
      {icon && <Box sx={{ mb: 2, color: tokens.color.brand500 }}>{icon}</Box>}
      <Typography variant="h6" sx={{ color: tokens.color.textMain, mb: 1, fontWeight: 600 }}>
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" sx={{ color: tokens.color.textDim, maxWidth: 460, mb: 3 }}>
          {description}
        </Typography>
      )}
      {action && <Box>{action}</Box>}
    </Box>
  );
};
