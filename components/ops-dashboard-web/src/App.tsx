// components/ops-dashboard-web/src/App.tsx
// <Admin> config only per §5.1

import React from 'react';
import { Admin, CustomRoutes } from 'react-admin';
import { Route, Navigate } from 'react-router-dom';
import { dataProvider } from './dataProvider/index.js';
import { authProvider } from './authProvider/index.js';
import { muiTheme } from './theme/muiTheme.js';
import { AppLayout } from './layout/AppLayout.js';
import { LoginPage } from './auth/LoginPage.js';

import { OverviewPage } from './resources/overview/OverviewPage.js';
import { CredentialList } from './resources/credentials/CredentialList.js';
import { ModerationQueueTabs } from './resources/moderationQueue/ModerationQueueTabs.js';
import { KeyRotationTabs } from './resources/keyRotation/KeyRotationTabs.js';
import { AuditLogList } from './resources/auditLog/AuditLogList.js';
import { SystemHealthPage } from './resources/systemHealth/SystemHealthPage.js';
import { PolicyGovernancePage } from './resources/governance/PolicyGovernancePage.js';
import { ProfilePage } from './resources/profile/ProfilePage.js';

export const App: React.FC = () => {
  return (
    <Admin
      dataProvider={dataProvider}
      authProvider={authProvider}
      theme={muiTheme}
      layout={AppLayout}
      loginPage={LoginPage}
      requireAuth
    >
      <CustomRoutes>
        <Route path="/overview" element={<OverviewPage />} />
        <Route path="/credentials" element={<CredentialList />} />
        <Route path="/moderation-queue" element={<ModerationQueueTabs />} />
        <Route path="/key-rotation" element={<KeyRotationTabs />} />
        <Route path="/governance" element={<PolicyGovernancePage />} />
        <Route path="/audit-log" element={<AuditLogList />} />
        <Route path="/system-health" element={<SystemHealthPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/" element={<Navigate to="/overview" replace />} />
      </CustomRoutes>
    </Admin>
  );
};

export default App;
