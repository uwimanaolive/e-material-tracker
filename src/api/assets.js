import { apiClient } from './client.js';

export const assetsApi = {
  getAll: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return await apiClient.get(`/assets${queryString ? `?${queryString}` : ''}`);
  },

  getById: async (id) => {
    return await apiClient.get(`/assets/${id}`);
  },

  getAvailable: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return await apiClient.get(`/assets/available/list${queryString ? `?${queryString}` : ''}`);
  },

  getStoreForDepartment: async (department, view = 'available') => {
    const params = new URLSearchParams();
    if (view) params.set('view', view);
    if (department && department !== 'all') {
      params.set('department', department);
    } else {
      params.set('scope', 'all');
    }
    const query = params.toString() ? `?${params.toString()}` : '';
    return await apiClient.get(`/assets/store/department${query}`);
  },

  create: async (data) => {
    return await apiClient.post('/assets', data);
  },

  update: async (id, data) => {
    return await apiClient.put(`/assets/${id}`, data);
  },

  retire: async (id) => {
    return await apiClient.delete(`/assets/${id}`);
  },
};
