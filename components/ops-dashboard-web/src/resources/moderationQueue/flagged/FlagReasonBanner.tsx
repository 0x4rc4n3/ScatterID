// components/ops-dashboard-web/src/resources/moderationQueue/flagged/FlagReasonBanner.tsx
import React from 'react';
import { Box, Typography, Paper } from '@mui/material';
import { AlertOctagon } from 'lucide-react';
import { tokens } from '@scatterid/design-tokens';

interface FlagReasonBannerProps {
  reason?: string | null;
  moderator?: string | null;
}

export const FlagReasonBanner: React.FC<FlagReasonBannerProps> = ({ reason, moderator }) => {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        mb: 2,
        backgroundColor: tokens.color.bgCard,
        borderColor: tokens.color.flag,
        borderLeft: 4,
        borderLeftColor: tokens.color.flag,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <AlertOctagon size={18} color={tokens.color.flag} />
        <Typography variant="subtitle2" sx={{ fontWeight: 800, color: tokens.color.flag }}>
          FLAGGED ANOMALY — INVESTIGATION REQUIRED
        </Typography>
      </Box>
      <Typography variant="body2" sx={{ color: tokens.color.textMain, fontWeight: 600 }}>
        {reason || 'Moderator flagged this intake request as suspicious or requiring manual audit.'}
      </Typography>
      {moderator && (
        <Typography variant="caption" sx={{ color: tokens.color.textDim, display: 'block', mt: 0.5 }}>
          Flagged by Moderator: {moderator}
        </Typography>
      )}
    </Paper>
  );
};
