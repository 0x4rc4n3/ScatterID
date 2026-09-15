// components/client-portal/frontend/src/desks/verify/Level2ResultCard.tsx
import React from 'react';
import { CheckCircle, XCircle, AlertTriangle, Key } from 'lucide-react';
import { VerificationMode } from '../../types/verifyResult.js';

interface Level2ResultCardProps {
  mode: VerificationMode;
  valid?: boolean;
  signatureLength?: number;
  isStandardSignatureLength?: boolean;
  publicKeyLength?: number;
  isStandardPublicKeyLength?: boolean;
  algorithm?: string;
  reason?: string;
}

export const Level2ResultCard: React.FC<Level2ResultCardProps> = ({
  mode,
  valid,
  signatureLength,
  isStandardSignatureLength,
  publicKeyLength,
  isStandardPublicKeyLength,
  algorithm = 'ML-DSA-65 (NIST FIPS 204)',
  reason,
}) => {
  const isOffline = mode === 'offline';

  return (
    <div
      className={`p-5 rounded-lg border shadow-sm mb-4 transition ${
        isOffline
          ? 'bg-amber-50/50 border-amber-300'
          : valid
          ? 'bg-emerald-50/50 border-brand300'
          : 'bg-red-50/50 border-red-200'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isOffline ? (
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          ) : valid ? (
            <CheckCircle className="w-5 h-5 text-approve" />
          ) : (
            <XCircle className="w-5 h-5 text-reject" />
          )}
          <h4 className="text-sm font-bold text-textOnLight">
            Level 2: Post-Quantum Signature & Ledger Anchor
          </h4>
        </div>

        <span
          className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
            isOffline
              ? 'bg-amber-100 text-amber-900 border border-amber-300'
              : valid
              ? 'bg-approve text-white'
              : 'bg-reject text-white'
          }`}
        >
          {isOffline
            ? 'Level 2: not available offline'
            : valid
            ? 'LEVEL 2 PASSED'
            : 'LEVEL 2 FAILED'}
        </span>
      </div>

      {isOffline ? (
        <div className="space-y-2 text-xs text-textOnLight">
          <p className="font-semibold text-amber-900">
            Structural container validation only — full cryptographic ML-DSA-65 math requires native liboqs bindings.
          </p>
          <div className="bg-white p-3 rounded border border-borderLight space-y-1.5 font-mono text-xs">
            <div className="flex justify-between items-center">
              <span>Signature Length:</span>
              <span className={isStandardSignatureLength ? 'text-brand700 font-bold' : 'text-amber-800'}>
                {signatureLength ? `${signatureLength} bytes (Standard: 3309B)` : 'Not present in bundle'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>Public Key Length:</span>
              <span className={isStandardPublicKeyLength ? 'text-brand700 font-bold' : 'text-amber-800'}>
                {publicKeyLength ? `${publicKeyLength} bytes (Standard: 1952B)` : 'Preshared fallback'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>Algorithm Standard:</span>
              <span className="text-textOnLight font-sans font-medium">{algorithm}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2 text-xs">
          <p className="text-textLightMuted">
            {valid
              ? 'Cryptographic authority confirmed valid ML-DSA-87 / ML-DSA-65 post-quantum signature. Hyperledger Fabric active anchor state verified.'
              : reason || 'Cryptographic signature is invalid or ledger anchor check failed.'}
          </p>
          <div className="bg-white p-3 rounded border border-borderLight font-mono text-xs text-textOnLight">
            <div>Algorithm: <span className="font-sans font-semibold">{algorithm}</span></div>
            <div>Authority: <span className="font-sans text-brand700 font-semibold">Post-Quantum Cryptographic Service</span></div>
          </div>
        </div>
      )}
    </div>
  );
};
