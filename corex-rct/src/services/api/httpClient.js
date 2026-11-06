import axios from 'axios';
import { tokenStorage } from './tokenStorage';

export const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  import.meta.env.REACT_APP_API_URL ||
  'http://127.0.0.1:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
});

// ── Interceptors ──────────────────────────────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = tokenStorage.get('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
}, Promise.reject);

// ── Silent token refresh ──────────────────────────────────────────────────────
// Access tokens are short-lived (15 min) and refresh tokens rotate: every
// refresh returns a NEW refresh token and retires the old one. So:
//  - only one refresh runs at a time (parallel 401s wait for it), otherwise
//    the second would present an already-retired token and log the user out;
//  - the rotated refresh token is stored;
//  - if refreshing fails because another tab already rotated the token, use
//    that tab's newer tokens instead of logging out.
// Auth endpoints themselves (wrong password = 401) never trigger a refresh.
const NO_REFRESH = ['/auth/login/', '/auth/token/refresh/', '/auth/register/', '/auth/forgot-password/',
  '/auth/reset-password/', '/auth/impersonate/exchange/', '/bookings/customers/register/', '/auth/2fa/verify/'];
let refreshing = null;

const refreshTokens = async () => {
  const used = tokenStorage.get('refreshToken');
  if (!used) throw new Error('no refresh token');
  try {
    const { data } = await axios.post(`${API_BASE_URL}/auth/token/refresh/`, { refresh: used },
      { headers: { 'ngrok-skip-browser-warning': 'true' } });
    tokenStorage.setTokens(data.access, data.refresh || used);
    return data.access;
  } catch (e) {
    const latest = tokenStorage.get('refreshToken');
    if (latest && latest !== used) return tokenStorage.get('accessToken'); // another tab rotated it
    throw e;
  }
};

const sendToLogin = () => {
  tokenStorage.clear();
  const { pathname, search } = window.location;
  const guestSite = pathname.startsWith('/book');
  const next = encodeURIComponent(pathname + search);
  window.location.href = guestSite ? `/book/login?next=${next}` : '/login';
};

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const orig = err.config || {};
    const isAuthCall = NO_REFRESH.some((path) => (orig.url || '').includes(path));
    if (err.response?.status !== 401 || orig._retry || isAuthCall || !tokenStorage.get('refreshToken')) {
      return Promise.reject(err);
    }
    orig._retry = true;
    try {
      refreshing = refreshing || refreshTokens().finally(() => { refreshing = null; });
      const access = await refreshing;
      orig.headers.Authorization = `Bearer ${access}`;
      return api(orig);
    } catch {
      sendToLogin();
      return Promise.reject(err);
    }
  }
);

export default api;
