// components/client-portal/frontend/src/auth/useAuth.ts
import { useContext } from 'react';
import { AuthContext, AuthContextValue } from './AuthContext.js';

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
