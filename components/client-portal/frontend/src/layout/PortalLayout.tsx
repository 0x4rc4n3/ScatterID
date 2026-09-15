// components/client-portal/frontend/src/layout/PortalLayout.tsx
import React, { useState } from 'react';
import { StationBar } from './StationBar.js';
import { DeskNav, ActiveDesk } from './DeskNav.js';
import { RequestTrackingModal } from '../desks/tracking/RequestTrackingModal.js';

interface PortalLayoutProps {
  activeDesk: ActiveDesk;
  onSelectDesk: (desk: ActiveDesk) => void;
  children: React.ReactNode;
}

export const PortalLayout: React.FC<PortalLayoutProps> = ({
  activeDesk,
  onSelectDesk,
  children,
}) => {
  const [trackingModalOpen, setTrackingModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-bgLight flex flex-col font-sans">
      <StationBar onOpenTracking={() => setTrackingModalOpen(true)} />
      <DeskNav activeDesk={activeDesk} onSelectDesk={onSelectDesk} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
      <footer className="py-4 border-t border-borderLight bg-white text-center text-xs text-textLightMuted">
        ScatterID Help Desk Portal
      </footer>

      <RequestTrackingModal
        open={trackingModalOpen}
        onClose={() => setTrackingModalOpen(false)}
      />
    </div>
  );
};
