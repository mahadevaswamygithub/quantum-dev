import api from './httpClient';
import { tokenStorage } from './tokenStorage';

export const authAPI = {
  register: (data) => api.post('/auth/register/', data),
  // Two-step verification. mfaToken is the short-lived ticket from login (password OK, code pending).
  verify2fa: (mfaToken, code) => api.post('/auth/2fa/verify/', { mfa_token: mfaToken, code }),
  setup2fa: (mfaToken) => api.post('/auth/2fa/setup/', mfaToken ? { mfa_token: mfaToken } : {}),
  enable2fa: (code, mfaToken) => api.post('/auth/2fa/enable/', mfaToken ? { code, mfa_token: mfaToken } : { code }),
  status2fa: () => api.get('/auth/2fa/status/'),
  disable2fa: (password, code) => api.post('/auth/2fa/disable/', { password, code }),
  newBackupCodes: (code) => api.post('/auth/2fa/backup-codes/', { code }),
  // { enabled } - is public organization sign-up open?
  signupStatus: () => api.get('/auth/register/'),
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
    // Sends this device's refresh token so the server revokes it (it can't be reused after logout).
    try { await api.post('/auth/logout/', { refresh: tokenStorage.get('refreshToken') }); } catch { /* ignore - logout proceeds regardless */ }
    tokenStorage.clear();
  },
};
