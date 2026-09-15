// components/ops-dashboard-web/src/resources/credentials/StatusBadge.tsx
import React from 'react';
import { Chip } from '@mui/material';
import { tokens } from '@scatterid/design-tokens';
import { CredentialStatus } from '../../types/credential.js';

interface StatusBadgeProps {
  status?: CredentialStatus | string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status = 'anchored' }) => {
  let color: string = tokens.color.textMuted;
  let label = status.toUpperCase();

  switch (status.toLowerCase()) {
    case 'anchored':
    case 'active':
      color = tokens.color.approve;
      label = 'ANCHORED';
      break;
    case 'revoked':
      color = tokens.color.reject;
      label = 'REVOKED';
      break;
    case 'pending':
      color = tokens.color.flag;
      label = 'PENDING';
      break;
  }

  return (
    <Chip
      size="small"
      label={label}
      sx={{
        backgroundColor: color,
        color: '#ffffff !important',
        fontWeight: 700,
        fontSize: '0.7rem',
        letterSpacing: '0.04em',
      }}
    />
  );
};
