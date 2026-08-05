import api from './httpClient';

export const attendanceAPI = {
  getUserAttendance: (userId, month) => api.get(`/attendance/records/`, { params: { user_id: userId, month } }),
  markAttendance: (data) => api.post('/attendance/records/', data),
  updateAttendance: (id, data) => api.put(`/attendance/records/${id}/`, data),
  deleteAttendance: (id) => api.delete(`/attendance/records/${id}/`),
  getMonthSummary: (userId, month) => api.get(`/attendance/summary/`, { params: { user_id: userId, month } }),
  bulkMark: (data) => api.post('/attendance/bulk_mark/', data),
  exportAttendance: (userId, month) => api.get('/attendance/export/', {
    params: { user_id: userId, month },
    responseType: 'blob',
  }),
};
