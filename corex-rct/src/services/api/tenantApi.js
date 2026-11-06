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
  uploadLogo: (id, formData) => api.post(`/tenants/organizations/${id}/upload_logo/`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  impersonateOrganization: (id) => api.post(`/tenants/organizations/${id}/impersonate/`),
  bulkActivate: (org_ids) => api.post('/tenants/organizations/bulk_activate/', { org_ids }),
  bulkDeactivate: (org_ids) => api.post('/tenants/organizations/bulk_deactivate/', { org_ids }),
  exportCSV: () => api.get('/tenants/organizations/export_csv/', { responseType: 'blob' }),
  getStatistics: () => api.get('/tenants/organizations/statistics/'),
  // The requesting admin's own organization (Settings → Organization)
  getMyOrganization: () => api.get('/tenants/organizations/mine/'),
  updateMyOrganization: (data) => api.patch('/tenants/organizations/mine/', data),
  uploadMyOrganizationLogo: (formData) => api.post('/tenants/organizations/mine/logo/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  uploadMyOrganizationCover: (formData) => api.post('/tenants/organizations/mine/cover/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  removeMyOrganizationCover: () => api.delete('/tenants/organizations/mine/cover/'),
  // Settings → Email (how guest emails are sent)
  getMyEmailSettings: () => api.get('/tenants/organizations/mine/email/'),
  updateMyEmailSettings: (data) => api.patch('/tenants/organizations/mine/email/', data),
  sendTestEmail: () => api.post('/tenants/organizations/mine/email/test/'),
  getPlatformStatus: () => api.get('/tenants/organizations/platform_status/'),
};
