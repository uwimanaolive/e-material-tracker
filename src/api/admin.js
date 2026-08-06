import { apiClient } from './client.js';

export const adminApi = {
  getStats: () => apiClient.get('/admin/stats'),
  getHrUsers: () => apiClient.get('/admin/hr-users'),
  createHrUser: (data) => apiClient.post('/admin/hr-users', data),
  updateHrUser: (id, data) => apiClient.put(`/admin/hr-users/${id}`, data),
  createDepartment: (data) => apiClient.post('/admin/departments', data),
  updateDepartment: (id, data) => apiClient.put(`/admin/departments/${id}`, data),
  createCategory: (data) => apiClient.post('/admin/categories', data),
  updateCategory: (id, data) => apiClient.put(`/admin/categories/${id}`, data),
};
