import api from './httpClient';

export const userAPI = {
  getUsers: () => api.get('/users/list/'),
  getUserById: (id) => api.get(`/users/list/${id}/`),
  createUser: (data) => api.post('/users/list/', data),
  updateUser: (id, data) => api.put(`/users/list/${id}/`, data),
  deleteUser: (id) => api.delete(`/users/list/${id}/`),
  toggleUserStatus: (id) => api.post(`/users/list/${id}/toggle_active/`),
  changeUserRole: (id, role) => api.put(`/users/list/${id}/change_role/`, { role }),
  getCurrentUser: () => api.get('/users/me/'),
  updateProfile: (data) => api.put('/users/me/', data),
  // Lost phone: turn off someone's two-step verification
  reset2fa: (id) => api.post(`/users/list/${id}/reset_2fa/`),
  // Re-send the set-your-password email to someone who hasn't set one yet
  resendInvite: (id) => api.post(`/users/list/${id}/resend_invite/`),
  // Settings → Roles & access (staff roles of the user's own organization)
  getRoles: (params) => api.get('/users/roles/', { params }),
  getRoleCatalog: () => api.get('/users/roles/catalog/'),
  createRole: (data) => api.post('/users/roles/', data),
  updateRole: (id, data) => api.put(`/users/roles/${id}/`, data),
  deleteRole: (id) => api.delete(`/users/roles/${id}/`),
  // Guest self-service account deletion (password confirmation required)
  deleteMyAccount: (password) => api.delete('/users/me/', { data: { password } }),
  uploadProfilePicture: (id, formData) => api.post(`/users/list/${id}/upload_picture/`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),

  // Documents
  getUserDocuments: (id) => api.get(`/users/list/${id}/documents/`),
  uploadDocument: (id, formData) => api.post(`/users/list/${id}/documents/`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  deleteDocument: (userId, docId) => api.delete(`/users/list/${userId}/documents/${docId}/`),

  // Bulk
  bulkActivate: (user_ids) => api.post('/users/list/bulk_activate/', { user_ids }),
  bulkDeactivate: (user_ids) => api.post('/users/list/bulk_deactivate/', { user_ids }),
  bulkDelete: (user_ids) => api.post('/users/list/bulk_delete/', { user_ids }),
  bulkChangeRole: (user_ids, role) => api.post('/users/list/bulk_change_role/', { user_ids, role }),

  // Export
  exportCSV: () => api.get('/users/list/export_csv/', { responseType: 'blob' }),
  exportJSON: () => api.get('/users/list/export_json/'),
  getStatistics: () => api.get('/users/list/statistics/'),
};
