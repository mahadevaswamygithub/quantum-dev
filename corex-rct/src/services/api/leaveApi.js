import api from './httpClient';

export const leaveAPI = {
  getUserLeaves: (userId) => api.get(`/leaves/requests/`, { params: { user_id: userId } }),
  getAllLeaves: () => api.get('/leaves/requests/'),
  applyLeave: (userId, data) => api.post('/leaves/requests/', { user_id: userId, ...data }),
  updateLeave: (id, data) => api.put(`/leaves/requests/${id}/`, data),
  deleteLeave: (id) => api.delete(`/leaves/requests/${id}/`),
  approveLeave: (id) => api.post(`/leaves/requests/${id}/approve/`),
  rejectLeave: (id) => api.post(`/leaves/requests/${id}/reject/`),
  getLeaveBalance: (userId) => api.get(`/leaves/balance/`, { params: { user_id: userId } }),
  getLeaveTypes: () => api.get('/leaves/types/'),
};
