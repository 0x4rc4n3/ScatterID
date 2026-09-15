// components/client-portal/frontend/src/desks/verify/VerifyDeskPage.tsx
import React, { useState } from 'react';
import { ModeToggle } from './ModeToggle.js';
import { InputMethodTabs, InputMethod } from './InputMethodTabs.js';
import { Level1ResultCard } from './Level1ResultCard.js';
import { Level2ResultCard } from './Level2ResultCard.js';
import { OfflineLimitationNotice } from './OfflineLimitationNotice.js';
import { RevokedAlertBox } from './RevokedAlertBox.js';
import { verifyLive } from '../../api/verifyApi.js';
import { verifyCredentialOffline } from '../../api/offlineVerify.js';
import { VerificationMode, LiveVerifyResult, OfflineVerifyResult } from '../../types/verifyResult.js';
import { CheckCircle2, ShieldCheck, AlertCircle } from 'lucide-react';

export const VerifyDeskPage: React.FC = () => {
  const [mode, setMode] = useState<VerificationMode>('live');
  const [method, setMethod] = useState<InputMethod>('id');
  const [credentialId, setCredentialId] = useState<string>('');
  const [dataHash, setDataHash] = useState<string>('');
  const [rawJson, setRawJson] = useState<string>('');

  const [verifying, setVerifying] = useState<boolean>(false);
  const [liveResult, setLiveResult] = useState<LiveVerifyResult | null>(null);
  const [offlineResult, setOfflineResult] = useState<OfflineVerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async () => {
    setError(null);
    setLiveResult(null);
    setOfflineResult(null);
    setVerifying(true);

    try {
      if (mode === 'live') {
        let payload: { credentialId?: string; dataHash?: string } = {};
        if (method === 'id') {
          if (!credentialId.trim()) throw new Error('Credential ID is required');
          payload.credentialId = credentialId.trim();
        } else if (method === 'hash') {
          if (!dataHash.trim()) throw new Error('Data Hash is required');
          payload.dataHash = dataHash.trim();
        } else {
          // JSON parsed for ID or dataHash
          const parsed = JSON.parse(rawJson);
          const cred = parsed.credential || parsed;
          if (cred.credentialId || cred.id) payload.credentialId = cred.credentialId || cred.id;
          if (cred.dataHash) payload.dataHash = cred.dataHash;
        }

        const res = await verifyLive(payload);
        setLiveResult(res);
      } else {
        // Offline Mode: Pure mathematics against baked-in preshared issuer keys
        let inputToVerify = rawJson;
        if (method === 'hash') {
          throw new Error('Offline mathematical verification requires the full claim JSON payload to canonicalize and compute SHA3-256');
        }
        if (method === 'id') {
          throw new Error('Offline mode has zero network transit to query by ID. Provide full credential JSON bundle.');
        }

        const res = verifyCredentialOffline(inputToVerify);
        setOfflineResult(res);
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const isRevoked =
    liveResult?.anchorStatus === 'revoked' ||
    liveResult?.reason?.toLowerCase().includes('revoked');

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-textOnLight">Verification Desk</h2>
        <p className="text-xs text-textLightMuted">
          Live ledger verification and offline mathematical signature attestation
        </p>
      </div>

      <ModeToggle
        mode={mode}
        onChange={m => {
          setMode(m);
          setLiveResult(null);
          setOfflineResult(null);
          setError(null);
          if (m === 'offline') setMethod('json');
        }}
      />

      <InputMethodTabs
        method={method}
        onChange={setMethod}
        credentialId={credentialId}
        onCredentialIdChange={setCredentialId}
        dataHash={dataHash}
        onDataHashChange={setDataHash}
        rawJson={rawJson}
        onRawJsonChange={setRawJson}
        disabledJsonTab={false}
      />

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-sm text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex justify-end mb-8">
        <button
          type="button"
          onClick={handleVerify}
          disabled={verifying}
          className="flex items-center gap-2 px-6 py-2.5 bg-brand500 hover:bg-brand700 text-white font-bold text-sm rounded-md shadow-sm transition disabled:opacity-50"
        >
          <ShieldCheck className="w-4 h-4" />
          {verifying ? 'Executing Verification...' : `Run ${mode === 'live' ? 'Live' : 'Offline'} Verification`}
        </button>
      </div>

      {mode === 'offline' && <OfflineLimitationNotice />}

      {isRevoked && (
        <RevokedAlertBox
          reason={liveResult?.reason}
          revokedAt={liveResult?.issuedAt}
        />
      )}

      {liveResult && (
        <div className="space-y-4">
          <Level1ResultCard
            passed={liveResult.valid || (!isRevoked && liveResult.anchorStatus === 'active')}
            expectedHash={liveResult.dataHash}
          />
          <Level2ResultCard
            mode="live"
            valid={liveResult.valid}
            reason={liveResult.reason}
          />
        </div>
      )}

      {offlineResult && (
        <div className="space-y-4">
          {offlineResult.error ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {offlineResult.error}
            </div>
          ) : (
            <>
              <Level1ResultCard
                passed={offlineResult.level1Passed}
                computedHash={offlineResult.computedHash}
                expectedHash={offlineResult.expectedHash}
                saltHex={offlineResult.saltHex}
              />
              <Level2ResultCard
                mode="offline"
                signatureLength={offlineResult.signatureLength}
                isStandardSignatureLength={offlineResult.isStandardSignatureLength}
                publicKeyLength={offlineResult.publicKeyLength}
                isStandardPublicKeyLength={offlineResult.isStandardPublicKeyLength}
                algorithm={offlineResult.algorithm}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
};
