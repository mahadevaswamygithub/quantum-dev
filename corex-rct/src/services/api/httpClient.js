import axios from 'axios';

export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
});

// ── Interceptors ──────────────────────────────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
}, Promise.reject);

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const orig = err.config;
    if (err.response?.status === 401 && !orig._retry) {
      orig._retry = true;
      try {
        const refresh = localStorage.getItem('refreshToken');
        const res = await axios.post(`${API_BASE_URL}/auth/token/refresh/`, { refresh });
        localStorage.setItem('accessToken', res.data.access);
        orig.headers.Authorization = `Bearer ${res.data.access}`;
        return api(orig);
      } catch {
        ['accessToken', 'refreshToken', 'user'].forEach(k => localStorage.removeItem(k));
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;
