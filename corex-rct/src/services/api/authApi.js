import api from './httpClient';
import { tokenStorage } from './tokenStorage';

export const authAPI = {
  register: (data) => api.post('/auth/register/', data),
  login: (data) => api.post('/auth/login/', data),
  refreshToken: (refresh) => api.post('/auth/token/refresh/', { refresh }),
  exchangeImpersonationCode: (code) => api.post('/auth/impersonate/exchange/', { code }),
  forgotPassword: (email) => api.post('/auth/forgot-password/', { email }),
  resetPassword: (uid, token, new_password, confirm_password) =>
    api.post('/auth/reset-password/', { uid, token, new_password, confirm_password }),
  changePassword: (old_password, new_password, confirm_password) =>
    api.post('/auth/change-password/', { old_password, new_password, confirm_password }),
  // Records the LOGOUT activity event before wiping local tokens. Best-effort:
  // an expired/already-cleared token, or the request simply failing, must
  // never block the user from actually logging out client-side.
  logout: async () => {
    try { await api.post('/auth/logout/'); } catch (e) { /* ignore — logout proceeds regardless */ }
    tokenStorage.clear();
  },
};
