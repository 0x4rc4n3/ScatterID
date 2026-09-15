// components/client-portal/frontend/src/desks/verify/OfflineLimitationNotice.tsx
import React from 'react';
import { AlertCircle, ShieldAlert } from 'lucide-react';

export const OfflineLimitationNotice: React.FC = () => {
  return (
    <div className="p-4 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-900 space-y-2 mb-4">
      <div className="flex items-center gap-2 font-bold text-amber-950">
        <ShieldAlert className="w-4 h-4 text-amber-700 flex-shrink-0" />
        <span>Mandatory High-Assurance Offline Scope & Freshness Notice</span>
      </div>
      <p>
        1. <span className="font-semibold">Scope:</span> This offline in-browser verifier mathematically proves <span className="font-semibold">Level 1 integrity</span> (RFC 8785 canonicalization + SHA3-256 pre-image commitment) and structural container compliance with NIST FIPS 204.
      </p>
      <p>
        2. <span className="font-semibold">Cryptographic Math:</span> Complete post-quantum ML-DSA-65 mathematical signature evaluation requires native liboqs bindings.
      </p>
      <p>
        3. <span className="font-semibold">Freshness & Revocation:</span> Offline verification confirms authentic issuance; <span className="underline font-semibold">it cannot confirm whether this credential has since been revoked on the live Hyperledger Fabric ledger</span>.
      </p>
    </div>
  );
};
