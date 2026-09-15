import React, { useState } from 'react';
import { AuthProvider } from './auth/AuthContext.js';
import { useAuth } from './auth/useAuth.js';
import { AppAbilityProvider, Can } from './auth/AbilityContext.js';
import { LoginPage } from './auth/LoginPage.js';
import { PortalLayout } from './layout/PortalLayout.js';
import { ActiveDesk } from './layout/DeskNav.js';
import { IssueDeskPage } from './desks/issue/IssueDeskPage.js';
import { VerifyDeskPage } from './desks/verify/VerifyDeskPage.js';
import { RevokeDeskPage } from './desks/revoke/RevokeDeskPage.js';
import { ShieldAlert } from 'lucide-react';

const AccessDeniedDesk: React.FC<{ deskName: string }> = ({ deskName }) => (
  <div className="max-w-xl mx-auto my-12 p-8 bg-white border border-red-200 rounded-lg shadow-sm text-center">
    <div className="flex justify-center mb-3 text-red-500">
      <ShieldAlert className="w-10 h-10" />
    </div>
    <div className="text-red-700 font-bold text-lg mb-2">Access Denied: {deskName} Desk</div>
    <p className="text-xs text-textLightMuted leading-relaxed">
      Your counter clerk credentials lack authorization to access the {deskName} Desk.
      Contact your system administrator to assign the necessary desk permissions.
    </p>
  </div>
);

const AuthenticatedPortal: React.FC = () => {
  const { user, loading } = useAuth();
  const [activeDesk, setActiveDesk] = useState<ActiveDesk>('verify');

  if (loading) {
    return (
      <div className="min-h-screen bg-bgLight flex items-center justify-center">
        <span className="text-sm font-semibold text-textLightMuted">Initializing Counter Terminal...</span>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <AppAbilityProvider>
      <PortalLayout activeDesk={activeDesk} onSelectDesk={setActiveDesk}>
        {activeDesk === 'verify' && (
          <Can I="access" a="VerifyDesk" passThrough>
            {({ isAllowed }: { isAllowed: boolean }) => (isAllowed ? <VerifyDeskPage /> : <AccessDeniedDesk deskName="Verify" />)}
          </Can>
        )}
        {activeDesk === 'issue' && (
          <Can I="access" a="IssueDesk" passThrough>
            {({ isAllowed }: { isAllowed: boolean }) => (isAllowed ? <IssueDeskPage /> : <AccessDeniedDesk deskName="Issue" />)}
          </Can>
        )}
        {activeDesk === 'revoke' && (
          <Can I="access" a="RevokeDesk" passThrough>
            {({ isAllowed }: { isAllowed: boolean }) => (isAllowed ? <RevokeDeskPage /> : <AccessDeniedDesk deskName="Revoke" />)}
          </Can>
        )}
      </PortalLayout>
    </AppAbilityProvider>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <AuthenticatedPortal />
    </AuthProvider>
  );
};

export default App;
