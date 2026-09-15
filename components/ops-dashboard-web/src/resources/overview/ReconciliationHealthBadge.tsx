// components/ops-dashboard-web/src/resources/overview/ReconciliationHealthBadge.tsx
import React from 'react';
import { Chip, Box, Typography } from '@mui/material';
import { CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { tokens } from '@scatterid/design-tokens';

interface ReconciliationHealthBadgeProps {
  status?: 'in_sync' | 'mismatch' | 'drift' | string;
  lastRun?: string;
}

export const ReconciliationHealthBadge: React.FC<ReconciliationHealthBadgeProps> = ({
  status = 'in_sync',
  lastRun,
}) => {
  const isInSync = status === 'in_sync';
  const color = isInSync ? tokens.color.approve : tokens.color.flag;
  const label = isInSync ? 'Ledger In Sync' : `Reconciliation ${status.toUpperCase()}`;
  const Icon = isInSync ? CheckCircle : AlertTriangle;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Chip
        icon={<Icon size={14} color="#ffffff" />}
        label={label}
        size="small"
        sx={{
          backgroundColor: color,
          color: '#ffffff !important',
          fontWeight: 700,
          fontSize: '0.75rem',
          '& .MuiChip-icon': { color: '#ffffff' },
        }}
      />
      {lastRun && (
        <Typography variant="caption" sx={{ color: tokens.color.textMuted }}>
          Last run: {new Date(lastRun).toLocaleTimeString()}
        </Typography>
      )}
    </Box>
  );
};
