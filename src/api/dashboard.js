import { apiClient } from './client.js';

export const dashboardApi = {
  getEmployeeStats: () => apiClient.get('/dashboard/employee'),
  getHeadStats: () => apiClient.get('/dashboard/head'),
  getInventoryStats: () => apiClient.get('/dashboard/inventory'),
  getProcurementStats: () => apiClient.get('/dashboard/inventory'),
  getHseStats: () => apiClient.get('/dashboard/hse'),
  getHrStats: () => apiClient.get('/dashboard/hr'),
  getAdminStats: () => apiClient.get('/admin/stats'),
};
