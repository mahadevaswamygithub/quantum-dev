import api from './httpClient';

export const tenantAPI = {
  getTenants: () => api.get('/tenants/organizations/'),
  getTenantById: (id) => api.get(`/tenants/organizations/${id}/`),
  getTenantUsers: (id) => api.get(`/tenants/organizations/${id}/users/`),
  getTenantStats: (id) => api.get(`/tenants/organizations/${id}/stats/`),
  createTenant: (data) => api.post('/tenants/organizations/', data),
  updateTenant: (id, data) => api.put(`/tenants/organizations/${id}/`, data),
  deleteTenant: (id) => api.delete(`/tenants/organizations/${id}/`),
  toggleTenantStatus: (id) => api.post(`/tenants/organizations/${id}/toggle_status/`),
  impersonateOrganization: (id) => api.post(`/tenants/organizations/${id}/impersonate/`),
  bulkActivate: (org_ids) => api.post('/tenants/organizations/bulk_activate/', { org_ids }),
  bulkDeactivate: (org_ids) => api.post('/tenants/organizations/bulk_deactivate/', { org_ids }),
  exportCSV: () => api.get('/tenants/organizations/export_csv/', { responseType: 'blob' }),
  getStatistics: () => api.get('/tenants/organizations/statistics/'),
};
