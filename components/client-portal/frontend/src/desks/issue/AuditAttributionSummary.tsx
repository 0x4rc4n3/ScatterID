// components/client-portal/frontend/src/desks/issue/AuditAttributionSummary.tsx
import React from 'react';
import { useAuth } from '../../auth/useAuth.js';
import { Shield, Clock, MapPin, UserCheck } from 'lucide-react';
import { SubmissionChannel } from '../../types/issueRequest.js';

interface AuditAttributionSummaryProps {
  channel?: string;
  claimantName: string;
}

export const AuditAttributionSummary: React.FC<AuditAttributionSummaryProps> = ({
  claimantName,
}) => {
  const { user, stationId } = useAuth();

  return (
    <div className="bg-white p-6 rounded-lg border border-borderLight shadow-sm mb-6">
      <h3 className="text-sm font-bold text-textOnLight mb-3">Station & Operator Attribution</h3>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-bgLight rounded-lg border border-borderLight text-xs">
        <div>
          <span className="text-textLightMuted block flex items-center gap-1 mb-1">
            <UserCheck className="w-3.5 h-3.5 text-brand500" /> Attributed Clerk:
          </span>
          <span className="font-bold text-textOnLight">{user?.username || 'clerk_john'}</span>
        </div>

        <div>
          <span className="text-textLightMuted block flex items-center gap-1 mb-1">
            <MapPin className="w-3.5 h-3.5 text-brand500" /> Counter Station:
          </span>
          <span className="font-bold text-textOnLight">{stationId}</span>
        </div>

        <div>
          <span className="text-textLightMuted block flex items-center gap-1 mb-1">
            <Shield className="w-3.5 h-3.5 text-brand500" /> Verification Scope:
          </span>
          <span className="font-bold text-brand700">In-Person + Scan</span>
        </div>

        <div>
          <span className="text-textLightMuted block flex items-center gap-1 mb-1">
            <Clock className="w-3.5 h-3.5 text-brand500" /> Record Subject:
          </span>
          <span className="font-bold text-textOnLight truncate block">{claimantName || 'Pending'}</span>
        </div>
      </div>
    </div>
  );
};
