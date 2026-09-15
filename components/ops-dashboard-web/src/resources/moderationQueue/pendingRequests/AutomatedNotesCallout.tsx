// components/ops-dashboard-web/src/resources/moderationQueue/pendingRequests/AutomatedNotesCallout.tsx
import React from 'react';
import { Box, Typography, Paper } from '@mui/material';
import { Info } from 'lucide-react';
import { tokens } from '@scatterid/design-tokens';

interface AutomatedNotesCalloutProps {
  notes?: string | null;
}

export const AutomatedNotesCallout: React.FC<AutomatedNotesCalloutProps> = ({ notes }) => {
  if (!notes) return null;

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        mb: 2,
        backgroundColor: tokens.color.bgCard,
        borderColor: tokens.color.borderSubtle,
        borderLeft: 3,
        borderLeftColor: tokens.color.cyanMid,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <Info size={14} color={tokens.color.cyanBright} />
        <Typography variant="caption" sx={{ fontWeight: 700, color: tokens.color.cyanBright }}>
          System Policy & Risk Engine Evaluation
        </Typography>
      </Box>
      <Typography variant="body2" sx={{ color: tokens.color.textMain, fontSize: '0.8125rem' }}>
        {notes}
      </Typography>
    </Paper>
  );
};
