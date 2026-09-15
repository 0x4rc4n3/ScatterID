// components/ops-dashboard-web/src/resources/moderationQueue/flagged/FlaggedTab.tsx
import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, Grid } from '@mui/material';
import { User, Radio, Calendar } from 'lucide-react';
import { httpClient } from '../../../dataProvider/httpClient.js';
import { ENDPOINTS } from '../../../dataProvider/endpoints.js';
import { ChannelBadge } from '../pendingRequests/ChannelBadge.js';
import { FlagReasonBanner } from './FlagReasonBanner.js';
import { CanAccess } from 'react-admin';
import { PermissionErrorScreen } from '../../../components/shared/PermissionErrorScreen.js';
import { RootAcceptControls } from '../awaitingAccept/RootAcceptControls.js';
import { ProofViewer } from '../pendingRequests/ProofViewer.js';
import { QueueMasterDetailLayout } from '../QueueMasterDetailLayout.js';
import { IntakeRequest } from '../../../types/request.js';
import { tokens } from '@scatterid/design-tokens';

export const FlaggedTab: React.FC = () => {
  const [requests, setRequests] = useState<IntakeRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedRequest, setSelectedRequest] = useState<IntakeRequest | null>(null);

  const fetchFlagged = async () => {
    try {
      setLoading(true);
      const res = await httpClient(ENDPOINTS.requests.flagged);
      const items = Array.isArray(res) ? res : res.requests || [];
      setRequests(items);
      if (selectedRequest) {
        const updated = items.find((r: IntakeRequest) => r.id === selectedRequest.id);
        setSelectedRequest(updated || (items.length > 0 ? items[0] : null));
      } else if (items.length > 0) {
        setSelectedRequest(items[0]);
      } else {
        setSelectedRequest(null);
      }
    } catch (err) {
      console.error('Failed to load flagged queue:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFlagged();
  }, []);

  const claimant = selectedRequest
    ? typeof selectedRequest.claimant_data === 'string'
      ? JSON.parse(selectedRequest.claimant_data || '{}')
      : selectedRequest.claimant_data || {}
    : {};

  return (
    <CanAccess
      resource="flagged"
      action="read"
      accessDenied={<PermissionErrorScreen resourceName="Flagged Queue" requiredRole="Root Administrator" />}
    >
      <QueueMasterDetailLayout
        title="Suspicious / Flagged"
        requests={requests}
        selectedRequest={selectedRequest}
        onSelectRequest={setSelectedRequest}
        loading={loading}
        onRefresh={fetchFlagged}
        accentColor={tokens.color.flag}
        emptyText="Zero anomalies flagged in system"
      >
        {selectedRequest ? (
          <Paper
            variant="outlined"
            sx={{
              p: 3,
              backgroundColor: tokens.color.bgSurface,
              borderColor: tokens.color.borderSubtle,
              borderRadius: 2,
            }}
          >
            {/* Header info */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
              <Box>
                <Typography variant="caption" sx={{ color: tokens.color.textDim }}>Intake Request ID</Typography>
                <Typography variant="h6" sx={{ fontWeight: 800, color: tokens.color.textMain, fontFamily: tokens.font.mono }}>
                  {selectedRequest.id}
                </Typography>
              </Box>
              <ChannelBadge channel={selectedRequest.submission_channel} />
            </Box>

            {/* Flag Reason Banner */}
            <FlagReasonBanner
              reason={selectedRequest.flag_reason || selectedRequest.moderator_notes}
              moderator={selectedRequest.moderator_id}
            />

            {/* Metadata Grid */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={4}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <User size={14} color={tokens.color.textDim} />
                  <Typography variant="caption" sx={{ color: tokens.color.textDim }}>Submitted By:</Typography>
                  <Typography variant="caption" sx={{ fontWeight: 600, color: tokens.color.textMain }}>
                    {selectedRequest.created_by || 'clerk'}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Radio size={14} color={tokens.color.textDim} />
                  <Typography variant="caption" sx={{ color: tokens.color.textDim }}>Station:</Typography>
                  <Typography variant="caption" sx={{ fontWeight: 600, color: tokens.color.textMain }}>
                    {selectedRequest.station_id || 'STATION-DESK-01'}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Calendar size={14} color={tokens.color.textDim} />
                  <Typography variant="caption" sx={{ color: tokens.color.textDim }}>Intake Time:</Typography>
                  <Typography variant="caption" sx={{ fontWeight: 600, color: tokens.color.textMain }}>
                    {new Date(selectedRequest.created_at).toLocaleString()}
                  </Typography>
                </Box>
              </Grid>
            </Grid>

            {/* Claimant Details */}
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

            {/* Proof viewer */}
            <ProofViewer request={selectedRequest} />

            {/* Root Decision Controls */}
            <RootAcceptControls
              request={selectedRequest}
              onDecisionComplete={fetchFlagged}
            />
          </Paper>
        ) : (
          <Paper
            variant="outlined"
            sx={{
              p: 6,
              textAlign: 'center',
              backgroundColor: tokens.color.bgSurface,
              borderColor: tokens.color.borderSubtle,
              color: tokens.color.textDim,
            }}
          >
            <Typography variant="body2">
              Select a flagged anomaly from the left list to inspect forensic details and execute Root action.
            </Typography>
          </Paper>
        )}
      </QueueMasterDetailLayout>
    </CanAccess>
  );
};
