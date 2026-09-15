// components/client-portal/frontend/src/desks/verify/ModeToggle.tsx
import React from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { VerificationMode } from '../../types/verifyResult.js';

interface ModeToggleProps {
  mode: VerificationMode;
  onChange: (mode: VerificationMode) => void;
}

export const ModeToggle: React.FC<ModeToggleProps> = ({ mode, onChange }) => {
  return (
    <div className="inline-flex p-1 bg-bgLight border border-borderLight rounded-lg mb-6">
      <button
        type="button"
        onClick={() => onChange('live')}
        className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold transition ${
          mode === 'live'
            ? 'bg-white text-brand700 shadow-sm border border-borderLight'
            : 'text-textLightMuted hover:text-textOnLight'
        }`}
      >
        <Wifi className="w-3.5 h-3.5 text-brand500" />
        Live Network Verification
      </button>

      <button
        type="button"
        onClick={() => onChange('offline')}
        className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold transition ${
          mode === 'offline'
            ? 'bg-white text-brand700 shadow-sm border border-borderLight'
            : 'text-textLightMuted hover:text-textOnLight'
        }`}
      >
        <WifiOff className="w-3.5 h-3.5 text-amber-600" />
        100% Offline Mode (Pure Mathematics)
      </button>
    </div>
  );
};
