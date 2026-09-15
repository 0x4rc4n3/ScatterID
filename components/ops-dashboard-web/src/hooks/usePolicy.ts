// components/ops-dashboard-web/src/hooks/usePolicy.ts
// Live policy engine consumer per Rule 5

import { useState, useEffect, useCallback } from 'react';
import { httpClient } from '../dataProvider/httpClient.js';
import { ENDPOINTS } from '../dataProvider/endpoints.js';
import { PolicyResponse, RoutingPolicyProfile } from '../types/policy.js';

export function usePolicy() {
  const [policyData, setPolicyData] = useState<PolicyResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPolicy = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await httpClient(ENDPOINTS.requests.policy);
      setPolicyData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load live routing policy');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPolicy();
  }, [fetchPolicy]);

  const updatePolicy = useCallback(
    async (profileOrConfig: string | Partial<RoutingPolicyProfile>, totpCode?: string) => {
      try {
        setLoading(true);
        const body = typeof profileOrConfig === 'string'
          ? { profile: profileOrConfig, totp_code: totpCode }
          : { customConfig: profileOrConfig, totp_code: totpCode };

        const result = await httpClient(ENDPOINTS.requests.policy, {
          method: 'POST',
          body: JSON.stringify(body),
        });
        await fetchPolicy();
        return result;
      } catch (err: any) {
        setError(err.message || 'Failed to update policy');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [fetchPolicy]
  );

  return {
    policy: policyData?.active || null,
    availableProfiles: policyData?.availableProfiles || [],
    loading,
    error,
    refreshPolicy: fetchPolicy,
    updatePolicy,
  };
}
