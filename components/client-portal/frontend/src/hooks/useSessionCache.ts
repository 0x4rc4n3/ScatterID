// components/client-portal/frontend/src/hooks/useSessionCache.ts
import { useState, useEffect } from 'react';

export function useSessionCache<T>(key: string, initialValue: T): [T, (val: T) => void, () => void] {
  const [state, setState] = useState<T>(() => {
    try {
      const item = sessionStorage.getItem(`portal_${key}`);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(`portal_${key}`, JSON.stringify(state));
    } catch {
      // storage full or disabled
    }
  }, [key, state]);

  const clearCache = () => {
    try {
      sessionStorage.removeItem(`portal_${key}`);
      setState(initialValue);
    } catch {
      // ignore
    }
  };

  return [state, setState, clearCache];
}
