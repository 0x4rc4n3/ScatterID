// components/ops-dashboard-web/src/types/policy.ts

export type ExecutionPolicyAction = 'AUTO_EXECUTE' | 'ROUTE_TO_ROOT';

export interface RoutingPolicyProfile {
  name: string;
  description: string;
  issuance: {
    standard?: ExecutionPolicyAction;
    hard?: ExecutionPolicyAction;
    soft?: ExecutionPolicyAction;
    [key: string]: ExecutionPolicyAction | undefined;
  };
  revocation: {
    standard?: ExecutionPolicyAction;
    hard?: ExecutionPolicyAction;
    soft?: ExecutionPolicyAction;
    [key: string]: ExecutionPolicyAction | undefined;
  };
  mandatoryCheckpoints: string[];
}

export interface PolicyResponse {
  active: RoutingPolicyProfile;
  availableProfiles: string[];
}
