// components/client-portal/frontend/src/desks/issue/ClaimantDetailsSection.tsx
import React from 'react';
import { IssueClaimantData } from '../../types/issueRequest.js';

interface ClaimantDetailsSectionProps {
  claimant: IssueClaimantData;
  onChange: (updated: IssueClaimantData) => void;
}

const PRESETS = [
  {
    title: 'National Civil Registry Record',
    data: {
      credentialType: 'CivilIdentityAttestation',
      subject: 'did:scatterid:record:8f92a10c',
      fullName: 'Alice M. Chen',
      identifierNumber: 'REC-9920148-X',
      issuingAuthority: 'Federal Civil Identity Registry',
      effectiveYear: 2026,
    },
  },
  {
    title: 'Professional Medical Practitioner',
    data: {
      credentialType: 'ProfessionalClearanceRecord',
      subject: 'did:scatterid:record:dr-martinez',
      fullName: 'Dr. Sofia Martinez',
      identifierNumber: 'PR-448201',
      issuingAuthority: 'National Medical Registry',
      effectiveYear: 2026,
    },
  },
  {
    title: 'Institutional Fintech Investor',
    data: {
      credentialType: 'InstitutionalStatusRecord',
      subject: 'did:scatterid:record:apex-holdings',
      fullName: 'Apex Capital Partners LLC',
      identifierNumber: 'FIN-88201-CORP',
      issuingAuthority: 'Financial Regulatory Council',
      effectiveYear: 2026,
    },
  },
];

export const ClaimantDetailsSection: React.FC<ClaimantDetailsSectionProps> = ({
  claimant,
  onChange,
}) => {
  const handleFieldChange = (field: keyof IssueClaimantData, val: any) => {
    onChange({
      ...claimant,
      [field]: val,
    });
  };

  return (
    <div className="bg-white p-6 rounded-lg border border-borderLight shadow-sm mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-textOnLight">Claimant & Subject Credentials</h3>
          <p className="text-xs text-textLightMuted">Specify structured identity fields for mathematical salt and commitment</p>
        </div>

        <div className="flex gap-2">
          {PRESETS.map(p => (
            <button
              key={p.title}
              type="button"
              onClick={() => onChange(p.data)}
              className="text-xs px-2.5 py-1 bg-bgLight hover:bg-slate100 border border-borderLight rounded text-textOnLight font-medium transition"
            >
              Preset: {p.data.fullName.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-textOnLight mb-1">Full Legal Name / Entity</label>
          <input
            type="text"
            required
            value={claimant.fullName}
            onChange={e => handleFieldChange('fullName', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-borderLight rounded-md focus:border-brand500 focus:outline-none"
            placeholder="e.g. Alice M. Chen"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-textOnLight mb-1">Subject DID / Identifier</label>
          <input
            type="text"
            required
            value={claimant.subject}
            onChange={e => handleFieldChange('subject', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-borderLight rounded-md focus:border-brand500 focus:outline-none font-mono text-xs"
            placeholder="did:scatterid:record:..."
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-textOnLight mb-1">Credential Type</label>
          <input
            type="text"
            required
            value={claimant.credentialType}
            onChange={e => handleFieldChange('credentialType', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-borderLight rounded-md focus:border-brand500 focus:outline-none"
            placeholder="e.g. CivilIdentityAttestation"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-textOnLight mb-1">Document / License Number</label>
          <input
            type="text"
            required
            value={claimant.identifierNumber}
            onChange={e => handleFieldChange('identifierNumber', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-borderLight rounded-md focus:border-brand500 focus:outline-none"
            placeholder="e.g. REC-9920148-X"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-textOnLight mb-1">Issuing Authority</label>
          <input
            type="text"
            required
            value={claimant.issuingAuthority}
            onChange={e => handleFieldChange('issuingAuthority', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-borderLight rounded-md focus:border-brand500 focus:outline-none"
            placeholder="e.g. Federal Civil Identity Registry"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-textOnLight mb-1">Effective Year</label>
          <input
            type="number"
            required
            value={claimant.effectiveYear}
            onChange={e => handleFieldChange('effectiveYear', parseInt(e.target.value, 10) || 2026)}
            className="w-full px-3 py-2 text-sm border border-borderLight rounded-md focus:border-brand500 focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
};
