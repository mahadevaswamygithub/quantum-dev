import axios from 'axios';

// Get API URL from environment variables with fallback
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api';

console.log('API Base URL configured:', API_BASE_URL);

// Create single axios instance for all API calls
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
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

// Add to existing authAPI object
export const authAPI = {
  register: (data) => api.post('/auth/register/', data),
  login: (data) => api.post('/auth/login/', data),
  refreshToken: (refresh) => api.post('/auth/token/refresh/', { refresh }),
  
  // Password management
  forgotPassword: (email) => api.post('/auth/forgot-password/', { email }),
  resetPassword: (uid, token, new_password, confirm_password) => 
    api.post('/auth/reset-password/', { uid, token, new_password, confirm_password }),
  changePassword: (old_password, new_password, confirm_password) => 
    api.post('/auth/change-password/', { old_password, new_password, confirm_password }),
  
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


// User APIs - Complete CRUD
export const userAPI = {
  getUsers: () => api.get('/users/list/'),
  getUserById: (id) => api.get(`/users/list/${id}/`),
  createUser: (data) => api.post('/users/list/', data),
  updateUser: (id, data) => api.put(`/users/list/${id}/`, data),
  deleteUser: (id) => api.delete(`/users/list/${id}/`),
  toggleUserStatus: (id) => api.post(`/users/list/${id}/toggle_active/`),
  changeUserRole: (id, role) => api.put(`/users/list/${id}/change_role/`, { role }),
  getCurrentUser: () => api.get('/users/me/'),

  // Bulk operations
  bulkActivate: (user_ids) => api.post('/users/list/bulk_activate/', { user_ids }),
  bulkDeactivate: (user_ids) => api.post('/users/list/bulk_deactivate/', { user_ids }),
  bulkDelete: (user_ids) => api.post('/users/list/bulk_delete/', { user_ids }),
  bulkChangeRole: (user_ids, role) => api.post('/users/list/bulk_change_role/', { user_ids, role }),
  
  // Export
  exportCSV: () => api.get('/users/list/export_csv/', { responseType: 'blob' }),
  exportJSON: () => api.get('/users/list/export_json/'),
  getStatistics: () => api.get('/users/list/statistics/'),
};


// Tenant APIs - Complete CRUD
export const tenantAPI = {
  getTenants: () => api.get('/tenants/organizations/'),
  getTenantById: (id) => api.get(`/tenants/organizations/${id}/`),
  getTenantUsers: (id) => api.get(`/tenants/organizations/${id}/users/`),
  getTenantStats: (id) => api.get(`/tenants/organizations/${id}/stats/`),
  createTenant: (data) => api.post('/tenants/organizations/', data),
  updateTenant: (id, data) => api.put(`/tenants/organizations/${id}/`, data),
  deleteTenant: (id) => api.delete(`/tenants/organizations/${id}/`),
  toggleTenantStatus: (id) => api.post(`/tenants/organizations/${id}/toggle_status/`),

  // Bulk operations
  bulkActivate: (org_ids) => api.post('/tenants/organizations/bulk_activate/', { org_ids }),
  bulkDeactivate: (org_ids) => api.post('/tenants/organizations/bulk_deactivate/', { org_ids }),
  
  // Export
  exportCSV: () => api.get('/tenants/organizations/export_csv/', { responseType: 'blob' }),
  getStatistics: () => api.get('/tenants/organizations/statistics/'),
};


export default api;