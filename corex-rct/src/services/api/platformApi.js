import api from './httpClient';

/** Platform owner console (role PLATFORM_ADMIN): customer accounts. */
const base = '/tenants/platform/customers';

export const platformAPI = {
  summary: () => api.get(`${base}/summary/`),
  list: (params) => api.get(`${base}/`, { params }),
  get: (id) => api.get(`${base}/${id}/`),
  create: (data) => api.post(`${base}/`, data),
  setLimit: (id, property_limit) => api.patch(`${base}/${id}/`, { property_limit }),
  // action: approve | suspend | reactivate | close
  setStatus: (id, action, reason = '') => api.post(`${base}/${id}/${action}/`, { reason }),
};
