// Agile Customizable Routing & Governance Policy Engine
// Allows client organizations to configure risk postures (Scenario B, A, C, or custom)
// Document ID: DEV-ARCH-08 / POLICY-ENG-01

export const POLICY_PROFILES = {
  // Default Tiered Risk (Scenario B): Hard auto-executes, Soft gates to Root, Revocations gate to Root
  SCENARIO_B: {
    name: 'Scenario B — Tiered Risk Policy',
    description: 'High-assurance in-person requests auto-execute upon moderator approval; remote and high-impact actions require Root Administrator authorization.',
    issuance: {
      hard: 'AUTO_EXECUTE',
      soft: 'ROUTE_TO_ROOT'
    },
    revocation: {
      hard: 'ROUTE_TO_ROOT',
      soft: 'ROUTE_TO_ROOT'
    },
    mandatoryCheckpoints: [
      'substrate_material_integrity',
      'optical_security_features',
      'biometric_face_match',
      'authority_seal_and_serial'
    ]
  },

  // Strict Dual Control (Scenario A): All actions require Root Authorization (Four-Eyes Principle)
  SCENARIO_A: {
    name: 'Scenario A — Strict Dual-Control Policy',
    description: 'Every issuance and revocation requires explicit Root Administrator review and execution, regardless of channel.',
    issuance: {
      hard: 'ROUTE_TO_ROOT',
      soft: 'ROUTE_TO_ROOT'
    },
    revocation: {
      hard: 'ROUTE_TO_ROOT',
      soft: 'ROUTE_TO_ROOT'
    },
    mandatoryCheckpoints: [
      'substrate_material_integrity',
      'optical_security_features',
      'biometric_face_match',
      'authority_seal_and_serial'
    ]
  },

  // Delegated High-Throughput (Scenario C): Moderators can auto-execute issuances, revocations remain Root-gated
  SCENARIO_C: {
    name: 'Scenario C — Delegated Operational Autonomy',
    description: 'Moderators possess direct ledger execution authority for issuances; revocations remain strictly Root-gated.',
    issuance: {
      hard: 'AUTO_EXECUTE',
      soft: 'AUTO_EXECUTE'
    },
    revocation: {
      hard: 'ROUTE_TO_ROOT',
      soft: 'ROUTE_TO_ROOT'
    },
    mandatoryCheckpoints: [
      'substrate_material_integrity',
      'optical_security_features',
      'biometric_face_match',
      'authority_seal_and_serial'
    ]
  }
};

let activePolicyProfile = process.env.SCATTERID_ROUTING_POLICY || 'SCENARIO_B';
let customPolicyOverride = null;

/**
 * Returns the currently active policy configuration.
 */
export function getActivePolicy() {
  if (customPolicyOverride) {
    return customPolicyOverride;
  }
  return POLICY_PROFILES[activePolicyProfile] || POLICY_PROFILES.SCENARIO_B;
}

/**
 * Sets the active policy profile by identifier or custom object.
 * Enables client organizations to configure their governance flow dynamically.
 */
export function setActivePolicy(profileOrConfig) {
  if (typeof profileOrConfig === 'string') {
    if (!POLICY_PROFILES[profileOrConfig]) {
      throw new Error(`Unknown policy profile: ${profileOrConfig}. Valid: ${Object.keys(POLICY_PROFILES).join(', ')}`);
    }
    activePolicyProfile = profileOrConfig;
    customPolicyOverride = null;
  } else if (typeof profileOrConfig === 'object' && profileOrConfig !== null) {
    if (!profileOrConfig.issuance || !profileOrConfig.revocation) {
      throw new Error('Custom policy must define both "issuance" and "revocation" routing mappings');
    }
    customPolicyOverride = {
      name: profileOrConfig.name || 'Custom Client Policy',
      description: profileOrConfig.description || 'Custom organization-specific governance rules',
      issuance: { ...profileOrConfig.issuance },
      revocation: { ...profileOrConfig.revocation },
      mandatoryCheckpoints: profileOrConfig.mandatoryCheckpoints || [
        'substrate_material_integrity',
        'optical_security_features',
        'biometric_face_match',
        'authority_seal_and_serial'
      ]
    };
  }
}

/**
 * Resets policy to default Scenario B.
 */
export function resetPolicyToDefault() {
  activePolicyProfile = 'SCENARIO_B';
  customPolicyOverride = null;
}

/**
 * Evaluates the policy outcome when a moderator approves a request.
 * Returns { action, targetStatus, message }
 */
export function evaluateModeratorApproval(request) {
  const policy = getActivePolicy();
  const reqType = (request.request_type || 'issuance').toLowerCase();
  const channel = (request.submission_channel || 'hard').toLowerCase();

  const routingRule = policy[reqType] ? policy[reqType][channel] : 'ROUTE_TO_ROOT';

  if (routingRule === 'AUTO_EXECUTE') {
    const policyCode = (activePolicyProfile === 'SCENARIO_B')
      ? 'SCENARIO_B_HARD_CHANNEL_AUTO_EXECUTE'
      : `${activePolicyProfile || 'CUSTOM'}_${reqType.toUpperCase()}_AUTO_EXECUTE`;
    return {
      action: 'AUTO_EXECUTE',
      targetStatus: 'EXECUTED_ON_LEDGER',
      escalated: false,
      policyCode,
      message: `Policy '${policy.name}' permits automatic ledger execution upon moderator approval.`
    };
  }

  const policyCode = (activePolicyProfile === 'SCENARIO_B')
    ? (reqType === 'revocation' ? 'SCENARIO_B_REVOCATION_ROOT_GATE_STRICT' : 'SCENARIO_B_SOFT_CHANNEL_ROOT_GATE')
    : `${activePolicyProfile || 'CUSTOM'}_${reqType.toUpperCase()}_ROOT_GATE`;

  return {
    action: 'ROUTE_TO_ROOT',
    targetStatus: 'AWAITING_ROOT_ACCEPT',
    escalated: true,
    policyCode,
    message: `Policy '${policy.name}' requires escalation to Root Administrator authorization.`
  };
}

/**
 * Validates the physical checklist against current mandatory checkpoints.
 */
export function validatePhysicalChecklist(checklistObj) {
  const policy = getActivePolicy();
  const mandatory = policy.mandatoryCheckpoints || [];

  if (!checklistObj || typeof checklistObj !== 'object') {
    return { valid: false, missing: mandatory };
  }

  const missing = mandatory.filter(key => !checklistObj[key]);
  return {
    valid: missing.length === 0,
    missing
  };
}

export default {
  POLICY_PROFILES,
  getActivePolicy,
  setActivePolicy,
  resetPolicyToDefault,
  evaluateModeratorApproval,
  validatePhysicalChecklist
};
