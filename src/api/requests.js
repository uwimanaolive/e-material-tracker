import { apiClient } from './client.js';

export const requestsApi = {
  getAll: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return await apiClient.get(`/requests${queryString ? `?${queryString}` : ''}`);
  },

  getMy: async () => apiClient.get('/requests/my'),

  getAssignedToMe: async () => apiClient.get('/requests/assigned-to-me'),

  getOwnerPending: async () => apiClient.get('/requests/owner/pending'),

  getOwnerTracking: async () => apiClient.get('/requests/owner/tracking'),

  getProcurementPending: async () => apiClient.get('/requests/procurement/pending'),

  getProcurementHistory: async () => apiClient.get('/requests/procurement/history'),

  getAvailableAssets: async (requestId) => apiClient.get(`/requests/${requestId}/available-assets`),

  getById: async (id) => apiClient.get(`/requests/${id}`),

  create: async (data) => apiClient.post('/requests', data),

  ownerAction: async (id, data) => apiClient.put(`/requests/${id}/owner-action`, data),

  procurementAction: async (id, data) => apiClient.put(`/requests/${id}/procurement-action`, data),
};
