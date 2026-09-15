// components/client-portal/frontend/src/desks/issue/SoftChannelUpload.tsx
import React, { useState } from 'react';
import { UploadCloud, FileCheck, AlertCircle } from 'lucide-react';
import { HashPreview } from '../../components/shared/HashPreview.js';

interface SoftChannelUploadProps {
  evidenceSha256: string;
  onEvidenceChange: (hash: string, base64Payload?: string) => void;
}

export const SoftChannelUpload: React.FC<SoftChannelUploadProps> = ({
  evidenceSha256,
  onEvidenceChange,
}) => {
  const [filename, setFilename] = useState<string>('');
  const [computing, setComputing] = useState<boolean>(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFilename(file.name);
    setComputing(true);

    try {
      const buffer = await file.arrayBuffer();
      // Standard WebCrypto SHA-256 for digital scan evidence
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      // Base64 encode for payload transmission
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1] || '';
        onEvidenceChange(hashHex, base64);
        setComputing(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Failed to hash evidence file:', err);
      setComputing(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg border border-borderLight shadow-sm mb-6">
      <div className="flex items-center gap-2 mb-2">
        <UploadCloud className="w-5 h-5 text-amber-500" />
        <h3 className="text-sm font-bold text-textOnLight">Digital Scan Evidence & SHA-256 Hash</h3>
      </div>
      <p className="text-xs text-textLightMuted mb-4">
        Upload scanned document, photo ID, or credential proof. The client calculates a SHA-256 cryptographic digest for audit attribution.
      </p>

      <div className="border-2 border-dashed border-borderLight rounded-lg p-6 text-center hover:border-amber-400 transition bg-bgLight">
        <input
          type="file"
          id="evidence-file"
          onChange={handleFileChange}
          className="hidden"
          accept="image/*,application/pdf"
        />
        <label htmlFor="evidence-file" className="cursor-pointer">
          <UploadCloud className="w-8 h-8 text-amber-500 mx-auto mb-2" />
          <span className="text-xs font-semibold text-textOnLight block">
            Click to upload scan (PDF, PNG, JPEG)
          </span>
          <span className="text-xs text-textLightMuted">
            File will be hashed client-side before submission
          </span>
        </label>
      </div>

      {filename && (
        <div className="mt-4 p-3 bg-slate100 rounded-md flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-brand500" />
            <span className="text-xs font-semibold text-textOnLight">{filename}</span>
          </div>
          {computing ? (
            <span className="text-xs text-amber-600 font-medium">Computing SHA-256...</span>
          ) : (
            <HashPreview hash={evidenceSha256} truncate />
          )}
        </div>
      )}

      {!evidenceSha256 && !computing && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-amber-700">
          <AlertCircle className="w-4 h-4" />
          <span>Digital evidence upload is required for Soft Channel intake submissions.</span>
        </div>
      )}
    </div>
  );
};
