import api from './httpClient';

export const authAPI = {
  register: (data) => api.post('/auth/register/', data),
  login: (data) => api.post('/auth/login/', data),
  refreshToken: (refresh) => api.post('/auth/token/refresh/', { refresh }),
  forgotPassword: (email) => api.post('/auth/forgot-password/', { email }),
  resetPassword: (uid, token, new_password, confirm_password) =>
    api.post('/auth/reset-password/', { uid, token, new_password, confirm_password }),
  changePassword: (old_password, new_password, confirm_password) =>
    api.post('/auth/change-password/', { old_password, new_password, confirm_password }),
  logout: () => ['accessToken', 'refreshToken', 'user'].forEach(k => localStorage.removeItem(k)),
};
