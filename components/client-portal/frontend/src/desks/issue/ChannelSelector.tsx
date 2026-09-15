// components/client-portal/frontend/src/desks/issue/ChannelSelector.tsx
import React from 'react';
import { Shield, UploadCloud } from 'lucide-react';
import { SubmissionChannel } from '../../types/issueRequest.js';

interface ChannelSelectorProps {
  selectedChannel: SubmissionChannel;
  onChange: (channel: SubmissionChannel) => void;
}

export const ChannelSelector: React.FC<ChannelSelectorProps> = ({ selectedChannel, onChange }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
      <div
        onClick={() => onChange('hard')}
        className={`cursor-pointer p-4 rounded-lg border-2 transition ${
          selectedChannel === 'hard'
            ? 'border-brand500 bg-brand50/30 shadow-sm'
            : 'border-borderLight bg-white hover:border-slate200'
        }`}
      >
        <div className="flex items-center gap-3 mb-2">
          <div className={`p-2 rounded-md ${selectedChannel === 'hard' ? 'bg-brand500 text-white' : 'bg-slate100 text-textLightMuted'}`}>
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-textOnLight">Hard Channel (Physical In-Person)</h4>
            <span className="text-xs text-brand700 font-semibold">Tier-1 High Assurance</span>
          </div>
        </div>
        <p className="text-xs text-textLightMuted">
          Verified at counter. Operator inspects substrate, holograms, seals, and biometrics. Zero document scans stored.
        </p>
      </div>

      <div
        onClick={() => onChange('soft')}
        className={`cursor-pointer p-4 rounded-lg border-2 transition ${
          selectedChannel === 'soft'
            ? 'border-amber-500 bg-amber-50/30 shadow-sm'
            : 'border-borderLight bg-white hover:border-slate200'
        }`}
      >
        <div className="flex items-center gap-3 mb-2">
          <div className={`p-2 rounded-md ${selectedChannel === 'soft' ? 'bg-amber-500 text-white' : 'bg-slate100 text-textLightMuted'}`}>
            <UploadCloud className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-textOnLight">Soft Channel (Digital Scan Upload)</h4>
            <span className="text-xs text-amber-800 font-semibold">Tier-2 Remote Digital Scan</span>
          </div>
        </div>
        <p className="text-xs text-textLightMuted">
          Digital document or image upload. Requires client-side SHA-256 evidence hash calculation. Mandatory Root gating.
        </p>
      </div>
    </div>
  );
};
