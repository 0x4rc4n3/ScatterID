// components/ops-dashboard-web/src/hooks/useCurrentUser.ts
import { useState, useEffect } from 'react';
import { useGetIdentity } from 'react-admin';
import { UserProfile, UserRole } from '../types/user.js';
import { getCachedCurrentUser } from '../authProvider/index.js';

export function useCurrentUser() {
  const { identity, isLoading } = useGetIdentity();
  const [profile, setProfile] = useState<UserProfile | null>(getCachedCurrentUser());

  useEffect(() => {
    if (identity) {
      setProfile(getCachedCurrentUser());
    }
  }, [identity]);

  const role: UserRole | undefined = (identity as any)?.role || profile?.role;
  const isRoot = role === 'root';
  const isMod = role === 'mod';

  return {
    user: profile,
    role,
    isRoot,
    isMod,
    isLoading,
  };
}
