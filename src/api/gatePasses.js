import { apiClient } from './client.js';

export const gatePassesApi = {
  getAll: async (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiClient.get(`/gate-passes${qs ? `?${qs}` : ''}`);
  },
  getMy: async () => apiClient.get('/gate-passes/my'),
  getHeadPending: async () => apiClient.get('/gate-passes/head/pending'),
  getHeadDepartment: async () => apiClient.get('/gate-passes/head/department'),
  getOwnerPending: async () => apiClient.get('/gate-passes/owner/pending'),
  getOwnerTracking: async () => apiClient.get('/gate-passes/owner/tracking'),
  getInventoryPending: async () => apiClient.get('/gate-passes/inventory/pending'),
  verify: async (token) => {
    const base = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    const res = await fetch(`${base}/gate-passes/verify/${token}`);
    return res.json();
  },
  getById: async (id) => apiClient.get(`/gate-passes/${id}`),
  create: async (data) => apiClient.post('/gate-passes', data),
  headAction: async (id, data) => apiClient.put(`/gate-passes/${id}/head-action`, data),
  ownerAction: async (id, data) => apiClient.put(`/gate-passes/${id}/owner-action`, data),
  inventoryAction: async (id, data) => apiClient.put(`/gate-passes/${id}/inventory-action`, data),
  complete: async (id, data) => apiClient.put(`/gate-passes/${id}/complete`, data),
};
