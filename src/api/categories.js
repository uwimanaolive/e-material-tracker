import { apiClient } from './client.js';

export const categoriesApi = {
  getAll: async () => {
    return await apiClient.get('/categories');
  },

  getById: async (id) => {
    return await apiClient.get(`/categories/${id}`);
  },

  create: async (data) => {
    return await apiClient.post('/categories', data);
  },

  update: async (id, data) => {
    return await apiClient.put(`/categories/${id}`, data);
  },
};
