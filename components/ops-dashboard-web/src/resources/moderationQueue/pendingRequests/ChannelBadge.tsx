import React from 'react';
import { Chip } from '@mui/material';
import { ShieldCheck, FileText } from 'lucide-react';
import { tokens } from '@scatterid/design-tokens';

interface ChannelBadgeProps {
  channel?: string;
}

export const ChannelBadge: React.FC<ChannelBadgeProps> = ({ channel = 'standard' }) => {
  const norm = (channel || 'standard').toLowerCase();
  const isLegacySoft = norm === 'soft';
  const label = isLegacySoft ? 'Digital Scan Submission' : 'In-Person Verified + Scan';
  const Icon = isLegacySoft ? FileText : ShieldCheck;

  return (
    <Chip
      size="small"
      icon={<Icon size={14} color={tokens.color.brand700} />}
      label={label}
      sx={{
        fontWeight: 700,
        fontSize: '0.75rem',
        backgroundColor: tokens.color.brand50,
        color: tokens.color.brand700,
        borderColor: tokens.color.brand300,
        borderWidth: 1,
        borderStyle: 'solid',
      }}
    />
  );
};
