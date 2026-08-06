import { apiClient } from './client.js';

export const assignmentsApi = {
  getAll: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return await apiClient.get(`/assignments${queryString ? `?${queryString}` : ''}`);
  },

  getMy: async () => {
    return await apiClient.get('/assignments/my');
  },

  getByDepartment: async (departmentId) => {
    return await apiClient.get(`/assignments/department/${departmentId}`);
  },

  getById: async (id) => {
    return await apiClient.get(`/assignments/${id}`);
  },

  create: async (data) => {
    return await apiClient.post('/assignments', data);
  },

  reassign: async (id, data) => {
    return await apiClient.put(`/assignments/${id}/reassign`, data);
  },

  return: async (id, data) => {
    return await apiClient.put(`/assignments/${id}/return`, data);
  },

  getDepartmentSummary: async (department) => {
    const qs = department ? `?department=${encodeURIComponent(department)}` : '';
    return await apiClient.get(`/assignments/department/summary${qs}`);
  },
};
