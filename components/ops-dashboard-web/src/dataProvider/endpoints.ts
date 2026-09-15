// components/ops-dashboard-web/src/dataProvider/endpoints.ts
// Resource name -> real API path mapping strictly per §6

export const ENDPOINTS = {
  auth: {
    login: '/api/auth/login',
    me: '/api/auth/me',
    logout: '/api/auth/logout',
    users: '/api/auth/users',
    resetPassword: '/api/auth/reset-password',
    demoLogin: '/api/auth/demo-login',
    firstTimeSetup: '/api/auth/first-time-setup',
    mfaEnroll: '/api/auth/mfa/enroll',
    mfaEnrollConfirm: '/api/auth/mfa/enroll/confirm',
    mfaTransferInit: '/api/auth/mfa/transfer/init',
    mfaTransferConfirm: '/api/auth/mfa/transfer/confirm',
  },
  requests: {
    stats: '/api/requests/stats',
    credentialsList: '/api/requests/credentials-list',
    detail: (id: string) => `/api/requests/${encodeURIComponent(id)}`,
    pending: '/api/requests/pending',
    awaitingRoot: '/api/requests/awaiting-root',
    flagged: '/api/requests/flagged',
    modDecide: (id: string) => `/api/requests/${encodeURIComponent(id)}/decide`,
    rootExecute: (id: string) => `/api/requests/${encodeURIComponent(id)}/root-execute`,
    policy: '/api/requests/policy',
    reconcile: '/api/requests/reconcile',
    auditLog: '/api/requests/audit-log',
  },
  keys: {
    gatewayRotate: '/api/keys/gateway/rotate',
    gatewayStatus: (keyName: string) => `/api/keys/gateway/status/${encodeURIComponent(keyName)}`,
    pqcPreStage: '/api/keys/pqc/pre-stage',
    pqcPromote: '/api/keys/pqc/promote',
    pqcPool: '/api/keys/pqc/pool',
    delegationCreate: '/api/keys/pqc/delegation/create',
    exportBackup: '/api/keys/pqc/export',
    restoreBackup: '/api/keys/pqc/restore',
  },
} as const;
