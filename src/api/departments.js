import { apiClient } from './client.js';

export const departmentsApi = {
  getAll: async () => {
    return await apiClient.get('/departments');
  },

  getById: async (id) => {
    return await apiClient.get(`/departments/${id}`);
  },

  getStaff: async (id) => {
    return await apiClient.get(`/departments/${id}/staff`);
  },

  getCategories: async (id) => {
    return await apiClient.get(`/departments/${id}/categories`);
  },

  setCategories: async (id, categoryIds) => {
    return await apiClient.put(`/departments/${id}/categories`, { category_ids: categoryIds });
  },

  create: async (data) => {
    return await apiClient.post('/departments', data);
  },

  update: async (id, data) => {
    return await apiClient.put(`/departments/${id}`, data);
  },
};
