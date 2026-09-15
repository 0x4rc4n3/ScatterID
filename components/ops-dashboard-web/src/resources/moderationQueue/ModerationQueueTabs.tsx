// components/ops-dashboard-web/src/resources/moderationQueue/ModerationQueueTabs.tsx
import React, { useState } from 'react';
import { Box, Typography, Tabs, Tab } from '@mui/material';
import { Clock, CheckSquare, AlertOctagon } from 'lucide-react';
import { PendingRequestsTab } from './pendingRequests/PendingRequestsTab.js';
import { AwaitingAcceptTab } from './awaitingAccept/AwaitingAcceptTab.js';
import { FlaggedTab } from './flagged/FlaggedTab.js';
import { useCanAccess } from 'react-admin';
import { tokens } from '@scatterid/design-tokens';

export const ModerationQueueTabs: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<number>(0);

  const { canAccess: canSeeAwaiting } = useCanAccess({ resource: 'awaitingAccept', action: 'read' });
  const { canAccess: canSeeFlagged } = useCanAccess({ resource: 'flagged', action: 'read' });

  const tabs = [
    { id: 'pending', label: 'Pending Intake', icon: <Clock size={16} />, component: <PendingRequestsTab /> },
    ...(canSeeAwaiting ? [{ id: 'awaiting', label: 'Awaiting Root Accept', icon: <CheckSquare size={16} />, component: <AwaitingAcceptTab /> }] : []),
    ...(canSeeFlagged ? [{ id: 'flagged', label: 'Flagged Anomalies', icon: <AlertOctagon size={16} />, component: <FlaggedTab /> }] : []),
  ];

  const activeIndex = Math.min(currentTab, Math.max(0, tabs.length - 1));

  return (
    <Box sx={{ height: 'calc(100vh - 130px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Box sx={{ mb: 1, flexShrink: 0 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: tokens.color.textMain }}>
          Moderation Queue
        </Typography>
      </Box>

      <Tabs
        value={activeIndex}
        onChange={(_, val) => setCurrentTab(val)}
        sx={{
          borderBottom: 1,
          borderColor: tokens.color.borderSubtle,
          mb: 1.5,
          flexShrink: 0,
          '& .MuiTab-root': {
            fontWeight: 700,
            textTransform: 'none',
            fontSize: '0.875rem',
            color: tokens.color.textDim,
            '&.Mui-selected': {
              color: tokens.color.brand500,
            },
          },
          '& .MuiTabs-indicator': {
            backgroundColor: tokens.color.brand500,
          },
        }}
      >
        {tabs.map(t => (
          <Tab key={t.id} icon={t.icon} iconPosition="start" label={t.label} />
        ))}
      </Tabs>

      <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {tabs[activeIndex]?.component}
      </Box>
    </Box>
  );
};
