// components/ops-dashboard-web/src/resources/moderationQueue/pendingRequests/PendingRequestsTab.tsx
import React, { useState, useEffect } from 'react';
import { Paper, Typography } from '@mui/material';
import { httpClient } from '../../../dataProvider/httpClient.js';
import { ENDPOINTS } from '../../../dataProvider/endpoints.js';
import { RequestDetailPanel } from './RequestDetailPanel.js';
import { QueueMasterDetailLayout } from '../QueueMasterDetailLayout.js';
import { IntakeRequest } from '../../../types/request.js';
import { tokens } from '@scatterid/design-tokens';

export const PendingRequestsTab: React.FC = () => {
  const [requests, setRequests] = useState<IntakeRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedRequest, setSelectedRequest] = useState<IntakeRequest | null>(null);

  const fetchPending = async () => {
    try {
      setLoading(true);
      const res = await httpClient(ENDPOINTS.requests.pending);
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
      console.error('Failed to load pending queue:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, []);

  return (
    <QueueMasterDetailLayout
      title="Pending Review"
      requests={requests}
      selectedRequest={selectedRequest}
      onSelectRequest={setSelectedRequest}
      loading={loading}
      onRefresh={fetchPending}
      accentColor={tokens.color.brand500}
      emptyText="Queue is empty — zero requests awaiting review"
    >
      {selectedRequest ? (
        <RequestDetailPanel
          request={selectedRequest}
          onDecisionComplete={fetchPending}
        />
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
            Select a pending request from the left list to review claimant proof and issue decision.
          </Typography>
        </Paper>
      )}
    </QueueMasterDetailLayout>
  );
};
