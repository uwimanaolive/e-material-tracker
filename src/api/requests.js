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
  getDeptAssignmentPending: async () => apiClient.get('/requests/dept-assignment/pending'),
  getInventoryPending: async () => apiClient.get('/requests/inventory/pending'),
  getInventoryHistory: async () => apiClient.get('/requests/inventory/history'),
  getAvailableAssets: async (requestId) => apiClient.get(`/requests/${requestId}/available-assets`),
  getById: async (id) => apiClient.get(`/requests/${id}`),
  create: async (data) => apiClient.post('/requests', data),
  ownerAction: async (id, data) => apiClient.put(`/requests/${id}/owner-action`, data),
  deptAssign: async (id, data) => apiClient.put(`/requests/${id}/dept-assign`, data),
  inventoryAction: async (id, data) => apiClient.put(`/requests/${id}/inventory-action`, data),
};
