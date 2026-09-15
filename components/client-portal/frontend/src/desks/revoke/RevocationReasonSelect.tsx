// components/client-portal/frontend/src/desks/revoke/RevocationReasonSelect.tsx
import React from 'react';
import { RevocationReason } from '../../types/revokeRequest.js';

interface RevocationReasonSelectProps {
  reason: RevocationReason | string;
  onReasonChange: (val: RevocationReason) => void;
  justification: string;
  onJustificationChange: (val: string) => void;
}

const REASONS: { value: RevocationReason; label: string; desc: string }[] = [
  {
    value: 'KEY_COMPROMISE',
    label: 'Private Key or Holder Secret Compromised',
    desc: 'Bearer reported theft or cryptographic material leakage.',
  },
  {
    value: 'LOST_CREDENTIAL',
    label: 'Physical Document or Security Token Lost',
    desc: 'Physical bearer card lost or damaged beyond verification.',
  },
  {
    value: 'ERRONEOUS_ISSUANCE',
    label: 'Erroneous Issuance / Data Entry Defect',
    desc: 'Intake mistake or incorrect identity attributes attached.',
  },
  {
    value: 'ADMINISTRATIVE_ACTION',
    label: 'Administrative Regulatory / Judicial Action',
    desc: 'Official court order, regulatory enforcement, or audit finding.',
  },
  {
    value: 'CHANGE_IN_CIRCUMSTANCES',
    label: 'Material Change in Bearer Circumstances',
    desc: 'Status expired, license suspended, or affiliation terminated.',
  },
];

export const RevocationReasonSelect: React.FC<RevocationReasonSelectProps> = ({
  reason,
  onReasonChange,
  justification,
  onJustificationChange,
}) => {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-textOnLight mb-1">
          Revocation Categorization Code (Mandatory)
        </label>
        <select
          value={reason}
          onChange={e => onReasonChange(e.target.value as RevocationReason)}
          className="w-full px-3 py-2 text-sm border border-borderLight rounded-md focus:border-reject focus:outline-none bg-white"
        >
          {REASONS.map(r => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-semibold text-textOnLight mb-1">
          Forensic Justification / Incident Details (Mandatory)
        </label>
        <textarea
          rows={3}
          required
          value={justification}
          onChange={e => onJustificationChange(e.target.value)}
          placeholder="Document the specific reasons, case file number, or incident details..."
          className="w-full px-3 py-2 text-sm border border-borderLight rounded-md focus:border-reject focus:outline-none bg-white"
        />
      </div>
    </div>
  );
};
