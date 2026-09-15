// components/ops-dashboard-web/src/dataProvider/index.ts
import { DataProvider } from 'react-admin';
import { httpClient } from './httpClient.js';
import { ENDPOINTS } from './endpoints.js';

export const dataProvider: DataProvider = {
  async getList(resource, params) {
    let url = '';
    switch (resource) {
      case 'credentials':
        url = ENDPOINTS.requests.credentialsList;
        break;
      case 'pendingRequests':
        url = ENDPOINTS.requests.pending;
        break;
      case 'awaitingAccept':
        url = ENDPOINTS.requests.awaitingRoot;
        break;
      case 'flagged':
        url = ENDPOINTS.requests.flagged;
        break;
      case 'auditLog':
        url = ENDPOINTS.requests.auditLog;
        break;
      case 'keyPool':
        url = ENDPOINTS.keys.pqcPool;
        break;
      case 'users':
        url = ENDPOINTS.auth.users;
        break;
      default:
        throw new Error(`Unknown resource: ${resource}`);
    }

    const data = await httpClient(url);
    const items = Array.isArray(data)
      ? data
      : (data.items || data.credentials || data.requests || data.logs || data.keys || data.users || []);

    // Filter, sort, pagination in-memory if backend returns whole list
    let result = [...items];

    // Ensure all items have an id property
    result = result.map((item, idx) => ({
      ...item,
      id: item.id || item.key_id || item.credentialId || `item-${idx}`,
    }));

    if (params.filter) {
      Object.entries(params.filter).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          result = result.filter(item => {
            const itemVal = item[key];
            if (typeof itemVal === 'string') {
              return itemVal.toLowerCase().includes(String(val).toLowerCase());
            }
            return itemVal === val;
          });
        }
      });
    }

    const total = result.length;
    if (params.pagination) {
      const { page, perPage } = params.pagination;
      const start = (page - 1) * perPage;
      result = result.slice(start, start + perPage);
    }

    return { data: result, total };
  },

  async getOne(resource, params) {
    if (resource === 'credentials' || resource === 'pendingRequests' || resource === 'awaitingAccept' || resource === 'flagged') {
      const data = await httpClient(ENDPOINTS.requests.detail(String(params.id)));
      return { data: { ...data, id: data.id || params.id } };
    }
    throw new Error(`getOne not supported for resource ${resource}`);
  },

  async getMany(resource, params) {
    const { data } = await this.getList(resource, {
      pagination: { page: 1, perPage: 100 },
      sort: { field: 'id', order: 'ASC' },
      filter: {},
    });
    return { data: data.filter(d => params.ids.includes(d.id)) };
  },

  async getManyReference(resource, params) {
    return this.getList(resource, {
      ...params,
      filter: { ...params.filter, [params.target]: params.id },
    });
  },

  async update(resource, params) {
    throw new Error(`Direct update not allowed on resource ${resource} — use explicit operations`);
  },

  async updateMany(resource, params) {
    throw new Error(`Direct updateMany not allowed on resource ${resource}`);
  },

  async create(resource, params) {
    throw new Error(`Direct create not allowed on resource ${resource} — use explicit intake`);
  },

  async delete(resource, params) {
    throw new Error(`Deletion forbidden by high-assurance immutability rules`);
  },

  async deleteMany(resource, params) {
    throw new Error(`Deletion forbidden by high-assurance immutability rules`);
  },
};
