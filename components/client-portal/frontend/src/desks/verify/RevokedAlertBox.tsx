// components/client-portal/frontend/src/desks/verify/RevokedAlertBox.tsx
import React from 'react';
import { ShieldX, AlertOctagon } from 'lucide-react';

interface RevokedAlertBoxProps {
  reason?: string;
  revokedAt?: string;
}

export const RevokedAlertBox: React.FC<RevokedAlertBoxProps> = ({ reason, revokedAt }) => {
  return (
    <div className="p-5 bg-red-50 border-2 border-reject rounded-lg text-xs text-red-950 space-y-2 mb-4">
      <div className="flex items-center gap-2 font-bold text-reject text-sm">
        <ShieldX className="w-5 h-5 flex-shrink-0" />
        <span>CREDENTIAL IS REVOKED ON-CHAIN</span>
      </div>
      <p className="font-semibold">
        This identity attestation has been explicitly revoked on the Hyperledger Fabric ledger and is no longer valid.
      </p>
      {reason && (
        <div className="bg-white p-2.5 rounded border border-red-200">
          <span className="text-textLightMuted block text-xs">Revocation Reason:</span>
          <span className="font-bold text-reject">{reason}</span>
        </div>
      )}
      {revokedAt && (
        <span className="text-textLightMuted block text-xs">
          Revoked timestamp: {new Date(revokedAt).toLocaleString()}
        </span>
      )}
    </div>
  );
};
