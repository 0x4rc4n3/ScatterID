// Unified Model Repositories Export

import { createUsersRepo } from './users.js';
import { createRecoveryCodesRepo } from './recoveryCodes.js';
import { createRequestsRepo } from './requests.js';
import { createAuditLogRepo } from './auditLog.js';
import { createGatewayKeysRepo } from './gatewayKeys.js';
import { createPqcKeysRepo } from './pqcKeys.js';

export {
  createUsersRepo,
  createRecoveryCodesRepo,
  createRequestsRepo,
  createAuditLogRepo,
  createGatewayKeysRepo,
  createPqcKeysRepo
};

export function createRepositories(db) {
  return {
    users: createUsersRepo(db),
    recoveryCodes: createRecoveryCodesRepo(db),
    requests: createRequestsRepo(db),
    auditLog: createAuditLogRepo(db),
    gatewayKeys: createGatewayKeysRepo(db),
    pqcKeys: createPqcKeysRepo(db)
  };
}

export default createRepositories;
