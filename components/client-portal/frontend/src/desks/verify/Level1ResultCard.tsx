// components/client-portal/frontend/src/desks/verify/Level1ResultCard.tsx
import React from 'react';
import { CheckCircle, XCircle, Hash, ShieldCheck } from 'lucide-react';
import { HashPreview } from '../../components/shared/HashPreview.js';

interface Level1ResultCardProps {
  passed: boolean;
  computedHash?: string;
  expectedHash?: string;
  saltHex?: string;
}

export const Level1ResultCard: React.FC<Level1ResultCardProps> = ({
  passed,
  computedHash,
  expectedHash,
  saltHex,
}) => {
  return (
    <div
      className={`p-5 rounded-lg border shadow-sm mb-4 transition ${
        passed
          ? 'bg-emerald-50/50 border-brand300'
          : 'bg-red-50/50 border-red-200'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {passed ? (
            <CheckCircle className="w-5 h-5 text-approve" />
          ) : (
            <XCircle className="w-5 h-5 text-reject" />
          )}
          <h4 className="text-sm font-bold text-textOnLight">
            Level 1: Zero-Knowledge Pre-image Commitment
          </h4>
        </div>
        <span
          className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
            passed ? 'bg-approve text-white' : 'bg-reject text-white'
          }`}
        >
          {passed ? 'LEVEL 1 PASSED' : 'LEVEL 1 FAILED'}
        </span>
      </div>

      <p className="text-xs text-textLightMuted mb-3">
        {passed
          ? 'Mathematical canonicalization (RFC 8785) and SHA3-256 hash commitment match stored record exactly. Zero attribute leakage confirmed.'
          : 'Tampering detected! The presented claim attributes do not match the cryptographic hash commitment.'}
      </p>

      {(computedHash || expectedHash) && (
        <div className="space-y-2 text-xs font-mono bg-white p-3 rounded border border-borderLight">
          {computedHash && (
            <div>
              <span className="text-textLightMuted block font-sans text-xs">Computed SHA3-256:</span>
              <span className="text-brand700 font-bold break-all">{computedHash}</span>
            </div>
          )}
          {expectedHash && (
            <div>
              <span className="text-textLightMuted block font-sans text-xs">Anchor Commitment:</span>
              <span className="text-textOnLight break-all">{expectedHash}</span>
            </div>
          )}
          {saltHex && (
            <div>
              <span className="text-textLightMuted block font-sans text-xs">CSPRNG Salt (16B):</span>
              <span className="text-textLightMuted break-all">{saltHex}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
