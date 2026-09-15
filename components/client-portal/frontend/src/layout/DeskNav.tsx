// components/client-portal/frontend/src/layout/DeskNav.tsx
import React from 'react';
import { PlusCircle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { useAbility } from '../auth/AbilityContext.js';

export type ActiveDesk = 'issue' | 'verify' | 'revoke';

interface DeskNavProps {
  activeDesk: ActiveDesk;
  onSelectDesk: (desk: ActiveDesk) => void;
}

export const DeskNav: React.FC<DeskNavProps> = ({ activeDesk, onSelectDesk }) => {
  const ability = useAbility();

  const desks = [
    { id: 'issue' as const, name: 'Issue Desk', icon: PlusCircle, description: 'Intake new credentials', subject: 'IssueDesk' as const },
    { id: 'verify' as const, name: 'Verify Desk', icon: CheckCircle2, description: 'Live & offline verification', subject: 'VerifyDesk' as const },
    { id: 'revoke' as const, name: 'Revoke Desk', icon: ShieldAlert, description: 'Initiate credential revocation', subject: 'RevokeDesk' as const },
  ].filter(desk => ability.can('access', desk.subject));

  return (
    <nav className="bg-white border-b border-borderLight px-6">
      <div className="flex space-x-8">
        {desks.map(desk => {
          const Icon = desk.icon;
          const isActive = activeDesk === desk.id;
          return (
            <button
              key={desk.id}
              onClick={() => onSelectDesk(desk.id)}
              className={`py-4 px-1 border-b-2 font-semibold text-sm flex items-center gap-2 transition ${
                isActive
                  ? 'border-brand500 text-brand500'
                  : 'border-transparent text-textLightMuted hover:text-textOnLight hover:border-borderLight'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{desk.name}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
