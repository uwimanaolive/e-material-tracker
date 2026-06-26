import { apiClient } from './client.js';

export const dashboardApi = {
  getEmployeeStats: async () => {
    return await apiClient.get('/dashboard/employee');
  },

  getHeadStats: async () => {
    return await apiClient.get('/dashboard/head');
  },

  getProcurementStats: async () => {
    return await apiClient.get('/dashboard/procurement');
  },

  getHrStats: async () => {
    return await apiClient.get('/dashboard/hr');
  },
};
