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
