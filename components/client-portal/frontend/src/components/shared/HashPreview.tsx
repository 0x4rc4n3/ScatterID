// components/client-portal/frontend/src/components/shared/HashPreview.tsx
import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface HashPreviewProps {
  hash: string;
  truncate?: boolean;
}

export const HashPreview: React.FC<HashPreviewProps> = ({ hash, truncate = false }) => {
  const [copied, setCopied] = useState(false);

  const display = truncate && hash.length > 16
    ? `${hash.slice(0, 8)}...${hash.slice(-8)}`
    : hash;

  const handleCopy = () => {
    navigator.clipboard.writeText(hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <span className="inline-flex items-center gap-1 font-mono text-xs bg-slate100 px-2 py-1 rounded border border-borderLight text-textOnLight">
      <span title={hash}>{display}</span>
      <button
        onClick={handleCopy}
        className="text-textLightMuted hover:text-brand500 transition ml-1"
        title="Copy hash"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-approve" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </span>
  );
};
