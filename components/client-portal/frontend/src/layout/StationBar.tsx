// components/client-portal/frontend/src/layout/StationBar.tsx
import React from 'react';
import { useAuth } from '../auth/useAuth.js';
import { ShieldCheck, MapPin, User, LogOut, Search } from 'lucide-react';

interface StationBarProps {
  onOpenTracking: () => void;
}

export const StationBar: React.FC<StationBarProps> = ({ onOpenTracking }) => {
  const { user, stationId, logout } = useAuth();

  return (
    <header className="bg-white border-b border-borderLight px-6 py-3 flex items-center justify-between sticky top-0 z-30 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-md bg-brand500 flex items-center justify-center text-white font-black text-lg">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-base font-bold text-textOnLight leading-none">ScatterID Counter Portal</h1>
          <span className="text-xs text-textLightMuted font-medium">Remote Site Help Desk</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={onOpenTracking}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-bgLight hover:bg-slate100 border border-borderLight text-xs font-semibold text-textOnLight rounded-md transition"
        >
          <Search className="w-3.5 h-3.5 text-brand500" />
          Track Request
        </button>

        <div className="h-4 w-px bg-borderLight" />

        <div className="flex items-center gap-1.5 text-xs text-textOnLight">
          <MapPin className="w-3.5 h-3.5 text-brand500" />
          <span className="font-semibold">{stationId}</span>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-textOnLight">
          <User className="w-3.5 h-3.5 text-textLightMuted" />
          <span className="font-semibold">{user?.username || 'Clerk'}</span>
        </div>

        <button
          onClick={() => logout()}
          title="Sign out"
          className="p-1.5 text-textLightMuted hover:text-reject transition rounded-md hover:bg-bgLight"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
