// components/ops-dashboard-web/src/resources/moderationQueue/pendingRequests/RequestDetailPanel.tsx
import React from 'react';
import { Box, Typography, Paper, Grid } from '@mui/material';
import { User, Radio, Calendar, Hash } from 'lucide-react';
import { IntakeRequest } from '../../../types/request.js';
import { ChannelBadge } from './ChannelBadge.js';
import { ProofViewer } from './ProofViewer.js';
import { AutomatedNotesCallout } from './AutomatedNotesCallout.js';
import { ModDecisionControls } from './ModDecisionControls.js';
import { tokens } from '@scatterid/design-tokens';

interface RequestDetailPanelProps {
  request: IntakeRequest;
  onDecisionComplete: () => void;
}

export const RequestDetailPanel: React.FC<RequestDetailPanelProps> = ({
  request,
  onDecisionComplete,
}) => {
  const claimant = typeof request.claimant_data === 'string'
    ? JSON.parse(request.claimant_data || '{}')
    : request.claimant_data || {};

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 3,
        backgroundColor: tokens.color.bgSurface,
        borderColor: tokens.color.borderSubtle,
        borderRadius: 2,
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="caption" sx={{ color: tokens.color.textDim }}>Intake Request ID</Typography>
          <Typography variant="h6" sx={{ fontWeight: 800, color: tokens.color.textMain, fontFamily: tokens.font.mono }}>
            {request.id}
          </Typography>
        </Box>
        <ChannelBadge channel={request.submission_channel} />
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <User size={14} color={tokens.color.textDim} />
            <Typography variant="caption" sx={{ color: tokens.color.textDim }}>Submitted By:</Typography>
            <Typography variant="caption" sx={{ fontWeight: 600, color: tokens.color.textMain }}>
              {request.created_by || 'clerk_john'}
            </Typography>
          </Box>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Radio size={14} color={tokens.color.textDim} />
            <Typography variant="caption" sx={{ color: tokens.color.textDim }}>Counter Station:</Typography>
            <Typography variant="caption" sx={{ fontWeight: 600, color: tokens.color.textMain }}>
              {request.station_id || 'STATION-DESK-01'}
            </Typography>
          </Box>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Calendar size={14} color={tokens.color.textDim} />
            <Typography variant="caption" sx={{ color: tokens.color.textDim }}>Timestamp:</Typography>
            <Typography variant="caption" sx={{ fontWeight: 600, color: tokens.color.textMain }}>
              {new Date(request.created_at).toLocaleString()}
            </Typography>
          </Box>
        </Grid>
      </Grid>

      <AutomatedNotesCallout notes={request.automated_notes} />

      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: tokens.color.textMain, mb: 1 }}>
          Claimant Details
        </Typography>
        <Paper
          variant="outlined"
          sx={{
            p: 2,
            backgroundColor: tokens.color.bgCard,
            borderColor: tokens.color.borderSubtle,
          }}
        >
          <Box
            component="pre"
            sx={{
              margin: 0,
              fontFamily: tokens.font.mono,
              fontSize: '0.75rem',
              color: tokens.color.textMain,
            }}
          >
            {JSON.stringify(claimant, null, 2)}
          </Box>
        </Paper>
      </Box>

      <ProofViewer request={request} />

      {((request.status || '').toLowerCase() === 'pending') && (
        <ModDecisionControls
          request={request}
          onDecisionComplete={onDecisionComplete}
        />
      )}
    </Paper>
  );
};
