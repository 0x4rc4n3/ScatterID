// components/client-portal/frontend/src/desks/issue/HardChannelChecklist.tsx
import React from 'react';
import { CheckSquare, Square, ShieldCheck } from 'lucide-react';
import { HardChecklistState } from '../../types/issueRequest.js';

interface HardChannelChecklistProps {
  checklist: HardChecklistState;
  onChange: (checklist: HardChecklistState) => void;
}

export const HardChannelChecklist: React.FC<HardChannelChecklistProps> = ({
  checklist,
  onChange,
}) => {
  const items = [
    {
      key: 'substrate_material_integrity' as const,
      title: 'Substrate & Physical Material Integrity',
      desc: 'Polycarbonate / security paper verified against micro-text and tactile embossing specifications.',
    },
    {
      key: 'optical_security_features' as const,
      title: 'Optical Security Hologram & Kinegram Features',
      desc: 'Diffractive optically variable device (DOVD) shifts properly under UV and angled illumination.',
    },
    {
      key: 'biometric_face_match' as const,
      title: 'In-Person Biometric Face Match',
      desc: 'Live bearer appearance confirmed matching physical document photograph without discrepancies.',
    },
    {
      key: 'authority_seal_and_serial' as const,
      title: 'Official Issuer Seal & Laser-Engraved Serial',
      desc: 'State authority intaglio seal and sequential serial verified against official registries.',
    },
  ];

  const handleToggle = (key: keyof HardChecklistState) => {
    onChange({
      ...checklist,
      [key]: !checklist[key],
    });
  };

  const allPassed = Object.values(checklist).every(Boolean);

  return (
    <div className="bg-white p-6 rounded-lg border border-borderLight shadow-sm mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-brand500" />
            <h3 className="text-sm font-bold text-textOnLight">Mandatory Physical In-Person Inspection (Hard Channel)</h3>
          </div>
          <p className="text-xs text-textLightMuted mt-0.5">
            All 4 physical checkpoints must be visually inspected and confirmed by the counter clerk.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            onChange({
              substrate_material_integrity: true,
              optical_security_features: true,
              biometric_face_match: true,
              authority_seal_and_serial: true,
            })
          }
          className="text-xs text-brand700 hover:text-brand500 font-semibold"
        >
          Check All (In-Person Inspected)
        </button>
      </div>

      <div className="space-y-3">
        {items.map(item => {
          const checked = checklist[item.key];
          return (
            <div
              key={item.key}
              onClick={() => handleToggle(item.key)}
              className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition ${
                checked
                  ? 'bg-brand50/40 border-brand300'
                  : 'bg-bgLight border-borderLight hover:border-slate300'
              }`}
            >
              <div className="mt-0.5 text-brand500">
                {checked ? <CheckSquare className="w-5 h-5 text-brand500" /> : <Square className="w-5 h-5 text-textLightMuted" />}
              </div>
              <div>
                <h4 className="text-xs font-bold text-textOnLight">{item.title}</h4>
                <p className="text-xs text-textLightMuted">{item.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      {!allPassed && (
        <p className="text-xs text-amber-700 mt-3 font-medium">
          Notice: Hard Channel issuance submission will fail unless all 4 physical inspection checkpoints are verified.
        </p>
      )}
    </div>
  );
};
