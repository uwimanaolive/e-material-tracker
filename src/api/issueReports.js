import { apiClient } from './client.js';

export const issueReportsApi = {
  getAll: async (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiClient.get(`/issue-reports${qs ? `?${qs}` : ''}`);
  },
  getMy: async () => apiClient.get('/issue-reports/my'),
  getHeadPending: async () => apiClient.get('/issue-reports/head/pending'),
  getHeadDepartment: async () => apiClient.get('/issue-reports/head/department'),
  getHsePending: async () => apiClient.get('/issue-reports/hse/pending'),
  getOwnerPending: async () => apiClient.get('/issue-reports/owner/pending'),
  getOwnerTracking: async () => apiClient.get('/issue-reports/owner/tracking'),
  getInventoryPending: async () => apiClient.get('/issue-reports/inventory/pending'),
  getInventoryHistory: async () => apiClient.get('/issue-reports/inventory/history'),
  getById: async (id) => apiClient.get(`/issue-reports/${id}`),
  create: async (data, attachment = null) => {
    if (attachment) {
      const formData = new FormData();
      Object.entries(data).forEach(([key, value]) => {
        if (value != null) formData.append(key, value);
      });
      formData.append('attachment', attachment);
      return apiClient.postFormData('/issue-reports', formData);
    }
    return apiClient.post('/issue-reports', data);
  },
  headAction: async (id, data) => apiClient.put(`/issue-reports/${id}/head-action`, data),
  hseAction: async (id, data) => apiClient.put(`/issue-reports/${id}/hse-action`, data),
  ownerAction: async (id, data) => apiClient.put(`/issue-reports/${id}/owner-action`, data),
  inventoryAction: async (id, data) => apiClient.put(`/issue-reports/${id}/inventory-action`, data),
};
