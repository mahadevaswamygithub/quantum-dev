import api from './httpClient';

export const activityAPI = {
  // params: { action, model_name, search, date_from, date_to }
  list: (params = {}) => api.get('/activity/', { params }),
};
