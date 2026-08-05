import api from './httpClient';

export const salaryAPI = {
  getUserSalary: (userId) => api.get(`/salary/records/`, { params: { user_id: userId } }),
  getSalaryById: (id) => api.get(`/salary/records/${id}/`),
  createSalary: (data) => api.post('/salary/records/', data),
  updateSalary: (id, data) => api.put(`/salary/records/${id}/`, data),
  deleteSalary: (id) => api.delete(`/salary/records/${id}/`),
  processSalary: (data) => api.post('/salary/process/', data),
  downloadPayslip: (salaryId) => api.get(`/salary/records/${salaryId}/payslip/`, { responseType: 'blob' }),

  // Advances
  getSalaryAdvances: (userId) => api.get(`/salary/advances/`, { params: { user_id: userId } }),
  requestAdvance: (userId, data) => api.post('/salary/advances/', { user_id: userId, ...data }),
  approveAdvance: (id) => api.post(`/salary/advances/${id}/approve/`),
  rejectAdvance: (id) => api.post(`/salary/advances/${id}/reject/`),

  // Settings
  getSalarySettings: () => api.get('/salary/settings/'),
  updateSalarySettings: (data) => api.put('/salary/settings/', data),
};
