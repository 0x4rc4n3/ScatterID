// components/ops-dashboard-web/src/hooks/useStaleQueueRefresh.ts
import { useEffect, useRef, useCallback } from 'react';
import { useRefresh } from 'react-admin';

export function useStaleQueueRefresh(intervalMs: number = 15000) {
  const refresh = useRefresh();
  const timerRef = useRef<any | null>(null);

  const startPolling = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      refresh();
    }, intervalMs);
  }, [refresh, intervalMs]);

  const stopPolling = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    startPolling();
    return () => stopPolling();
  }, [startPolling, stopPolling]);

  return { triggerRefresh: refresh, startPolling, stopPolling };
}
