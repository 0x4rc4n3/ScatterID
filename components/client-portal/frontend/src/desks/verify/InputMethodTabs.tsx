// components/client-portal/frontend/src/desks/verify/InputMethodTabs.tsx
import React from 'react';
import { CreditCard, Hash, FileJson } from 'lucide-react';

export type InputMethod = 'id' | 'hash' | 'json';

interface InputMethodTabsProps {
  method: InputMethod;
  onChange: (method: InputMethod) => void;
  credentialId: string;
  onCredentialIdChange: (val: string) => void;
  dataHash: string;
  onDataHashChange: (val: string) => void;
  rawJson: string;
  onRawJsonChange: (val: string) => void;
  disabledJsonTab?: boolean;
}

export const InputMethodTabs: React.FC<InputMethodTabsProps> = ({
  method,
  onChange,
  credentialId,
  onCredentialIdChange,
  dataHash,
  onDataHashChange,
  rawJson,
  onRawJsonChange,
}) => {
  return (
    <div className="bg-white p-6 rounded-lg border border-borderLight shadow-sm mb-6">
      <div className="flex border-b border-borderLight mb-4">
        <button
          type="button"
          onClick={() => onChange('id')}
          className={`pb-3 px-4 text-xs font-bold flex items-center gap-1.5 border-b-2 transition ${
            method === 'id'
              ? 'border-brand500 text-brand500'
              : 'border-transparent text-textLightMuted hover:text-textOnLight'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          By Credential ID
        </button>

        <button
          type="button"
          onClick={() => onChange('hash')}
          className={`pb-3 px-4 text-xs font-bold flex items-center gap-1.5 border-b-2 transition ${
            method === 'hash'
              ? 'border-brand500 text-brand500'
              : 'border-transparent text-textLightMuted hover:text-textOnLight'
          }`}
        >
          <Hash className="w-4 h-4" />
          By SHA3-256 Hash
        </button>

        <button
          type="button"
          onClick={() => onChange('json')}
          className={`pb-3 px-4 text-xs font-bold flex items-center gap-1.5 border-b-2 transition ${
            method === 'json'
              ? 'border-brand500 text-brand500'
              : 'border-transparent text-textLightMuted hover:text-textOnLight'
          }`}
        >
          <FileJson className="w-4 h-4" />
          By Raw Credential JSON (Full Math)
        </button>
      </div>

      {method === 'id' && (
        <div>
          <label className="block text-xs font-semibold text-textOnLight mb-1">
            Credential UUID Identifier
          </label>
          <input
            type="text"
            value={credentialId}
            onChange={e => onCredentialIdChange(e.target.value)}
            placeholder="e.g. 8f92a10c-9920-4148-b420-1a2b3c4d5e6f"
            className="w-full px-3 py-2 text-sm border border-borderLight rounded-md focus:border-brand500 focus:outline-none font-mono"
          />
        </div>
      )}

      {method === 'hash' && (
        <div>
          <label className="block text-xs font-semibold text-textOnLight mb-1">
            64-Character SHA3-256 Anchor Hash
          </label>
          <input
            type="text"
            value={dataHash}
            onChange={e => onDataHashChange(e.target.value)}
            placeholder="e.g. e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
            maxLength={64}
            className="w-full px-3 py-2 text-sm border border-borderLight rounded-md focus:border-brand500 focus:outline-none font-mono text-xs"
          />
        </div>
      )}

      {method === 'json' && (
        <div>
          <label className="block text-xs font-semibold text-textOnLight mb-1">
            Credential Payload JSON (includes rawClaim, salt, signature)
          </label>
          <textarea
            rows={6}
            value={rawJson}
            onChange={e => onRawJsonChange(e.target.value)}
            placeholder='{\n  "credentialId": "cred-alice-9920",\n  "rawClaim": { "subject": "Alice" },\n  "salt": "a1b2c3d4...",\n  "dataHash": "..."\n}'
            className="w-full p-3 text-xs border border-borderLight rounded-md focus:border-brand500 focus:outline-none font-mono bg-bgLight"
          />
        </div>
      )}
    </div>
  );
};
