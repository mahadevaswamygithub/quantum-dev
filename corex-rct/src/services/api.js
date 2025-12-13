import axios from 'axios';

// Get API URL from environment variables with fallback
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api';

console.log('API Base URL configured:', API_BASE_URL);

// Create single axios instance for all API calls
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        const response = await axios.post(`${API_BASE_URL}/auth/token/refresh/`, {
          refresh: refreshToken,
        });

        const { access } = response.data;
        localStorage.setItem('accessToken', access);

        originalRequest.headers.Authorization = `Bearer ${access}`;
        return api(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Auth APIs
export const authAPI = {
  register: (data) => api.post('/auth/register/', data),
  login: (data) => api.post('/auth/login/', data),
  refreshToken: (refresh) => api.post('/auth/token/refresh/', { refresh }),
  logout: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  },
};

// Green Admin APIs
export const greenAdminAPI = {
  getTenants: () => api.get('/green-admin/tenants/'),
  getTenantById: (id) => api.get(`/green-admin/tenants/${id}/`),
  getUsers: () => api.get('/green-admin/users/'),
  getStats: () => api.get('/green-admin/stats/'),
};

// User APIs
export const userAPI = {
  getUsers: () => api.get('/users/list/'),
  getUserById: (id) => api.get(`/users/list/${id}/`),
  updateUser: (id, data) => api.put(`/users/list/${id}/`, data),
  deleteUser: (id) => api.delete(`/users/list/${id}/`),
  getCurrentUser: () => api.get('/users/me/'),
};

// Tenant APIs
export const tenantAPI = {
  getTenants: () => api.get('/tenants/organizations/'),
  getTenantById: (id) => api.get(`/tenants/organizations/${id}/`),
  createTenant: (data) => api.post('/tenants/organizations/', data),
  updateTenant: (id, data) => api.put(`/tenants/organizations/${id}/`, data),
};

export default api;