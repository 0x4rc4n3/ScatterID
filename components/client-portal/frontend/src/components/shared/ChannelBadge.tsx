// components/client-portal/frontend/src/components/shared/ChannelBadge.tsx
import React from 'react';
import { Shield, UploadCloud } from 'lucide-react';
import { SubmissionChannel } from '../../types/issueRequest.js';

export const ChannelBadge: React.FC<{ channel: SubmissionChannel }> = ({ channel }) => {
  const isHard = channel === 'hard';
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
        isHard
          ? 'bg-emerald-50 text-brand700 border border-brand300'
          : 'bg-amber-50 text-amber-800 border border-amber-300'
      }`}
    >
      {isHard ? <Shield className="w-3.5 h-3.5 text-brand500" /> : <UploadCloud className="w-3.5 h-3.5 text-amber-600" />}
      {isHard ? 'Hard Channel (In-Person Checklist)' : 'Soft Channel (Digital Scan Upload)'}
    </span>
  );
};
