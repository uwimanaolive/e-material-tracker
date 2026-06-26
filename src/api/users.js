import { apiClient } from './client.js';

export const usersApi = {
  getAll: async () => {
    return await apiClient.get('/users');
  },

  getById: async (id) => {
    return await apiClient.get(`/users/${id}`);
  },

  getByDepartment: async (departmentId) => {
    return await apiClient.get(`/users/department/${departmentId}`);
  },

  create: async (data) => {
    return await apiClient.post('/users', data);
  },

  update: async (id, data) => {
    return await apiClient.put(`/users/${id}`, data);
  },
};
