// components/client-portal/frontend/src/desks/revoke/CredentialIdSearch.tsx
import React from 'react';
import { Search } from 'lucide-react';

interface CredentialIdSearchProps {
  value: string;
  onChange: (val: string) => void;
}

export const CredentialIdSearch: React.FC<CredentialIdSearchProps> = ({ value, onChange }) => {
  return (
    <div className="mb-4">
      <label className="block text-xs font-semibold text-textOnLight mb-1">
        Target Credential ID to Revoke
      </label>
      <div className="relative">
        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-textLightMuted">
          <Search className="w-4 h-4" />
        </span>
        <input
          type="text"
          required
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="e.g. 8f92a10c-9920-4148-b420-1a2b3c4d5e6f or cred-alice-9920"
          className="w-full pl-9 pr-3 py-2 text-sm border border-borderLight rounded-md focus:border-reject focus:outline-none font-mono"
        />
      </div>
    </div>
  );
};
