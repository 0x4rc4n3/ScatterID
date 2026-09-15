// components/client-portal/frontend/src/auth/AbilityContext.tsx
// React Context and Hooks for CASL Ability integration

import React, { useMemo } from 'react';
import { AbilityProvider, Can, useAbility } from '@casl/react';
import { AppAbility, buildAbilityForUser } from './ability.js';
import { useAuth } from './useAuth.js';

export { Can, useAbility };

export const AppAbilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const ability = useMemo<AppAbility>(() => buildAbilityForUser(user), [user]);

  return (
    <AbilityProvider value={ability}>
      {children}
    </AbilityProvider>
  );
};
