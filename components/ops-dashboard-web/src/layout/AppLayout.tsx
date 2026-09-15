// components/ops-dashboard-web/src/layout/AppLayout.tsx
import React from 'react';
import { Box } from '@mui/material';
import { TopBar } from './TopBar.js';
import { Sidebar } from './Sidebar.js';
import { tokens } from '@scatterid/design-tokens';

export interface AppLayoutProps {
  children?: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: tokens.color.bgBase }}>
      <TopBar />
      <Box sx={{ display: 'flex', flex: 1 }}>
        <Sidebar />
        <Box
          component="main"
          sx={{
            flex: 1,
            p: 3,
            overflowY: 'auto',
            height: 'calc(100vh - 57px)',
            backgroundColor: tokens.color.bgBase,
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
};
