// components/ops-dashboard-web/src/layout/RoleBadge.tsx
import React from 'react';
import { Chip } from '@mui/material';
import { getRoleColor, getRoleBackgroundColor } from '../theme/roleBadgeColors.js';
import { UserRole } from '../types/user.js';
import { tokens } from '@scatterid/design-tokens';

interface RoleBadgeProps {
  role?: UserRole | string;
}

export const RoleBadge: React.FC<RoleBadgeProps> = ({ role }) => {
  const displayRole = role || 'operator';
  const color = getRoleColor(displayRole);
  const bgColor = getRoleBackgroundColor(displayRole);

  return (
    <Chip
      size="small"
      label={displayRole.toUpperCase()}
      sx={{
        fontWeight: 700,
        fontSize: '0.75rem',
        letterSpacing: '0.05em',
        color: color,
        borderColor: color,
        backgroundColor: bgColor,
        borderWidth: 1,
        borderStyle: 'solid',
      }}
    />
  );
};
