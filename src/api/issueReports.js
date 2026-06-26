import { apiClient } from './client.js';

export const issueReportsApi = {
  getAll: async (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiClient.get(`/issue-reports${qs ? `?${qs}` : ''}`);
  },

  getMy: async () => apiClient.get('/issue-reports/my'),

  getHeadPending: async () => apiClient.get('/issue-reports/head/pending'),

  getHeadDepartment: async () => apiClient.get('/issue-reports/head/department'),

  getProcurementHistory: async () => apiClient.get('/issue-reports/procurement/history'),

  getOwnerPending: async () => apiClient.get('/issue-reports/owner/pending'),

  getOwnerTracking: async () => apiClient.get('/issue-reports/owner/tracking'),

  getProcurementPending: async () => apiClient.get('/issue-reports/procurement/pending'),

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

  ownerAction: async (id, data) => apiClient.put(`/issue-reports/${id}/owner-action`, data),

  procurementAction: async (id, data) => apiClient.put(`/issue-reports/${id}/procurement-action`, data),
};
