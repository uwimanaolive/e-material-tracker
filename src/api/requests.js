import { apiClient } from './client.js';

export const requestsApi = {
  getAll: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return await apiClient.get(`/requests${queryString ? `?${queryString}` : ''}`);
  },

  getMy: async () => apiClient.get('/requests/my'),
  getReturned: async () => apiClient.get('/requests/returned'),
  cancel: async (id, data = {}) => apiClient.put(`/requests/${id}/cancel`, data),
  getOwnerPending: async () => apiClient.get('/requests/owner/pending'),
  getOwnerTracking: async () => apiClient.get('/requests/owner/tracking'),
  getAssignedToMe: async () => apiClient.get('/requests/assigned-to-me'),
  getDeptAssignmentPending: async () => apiClient.get('/requests/dept-assignment/pending'),
  getInventoryPending: async () => apiClient.get('/requests/inventory/pending'),
  getInventoryHistory: async () => apiClient.get('/requests/inventory/history'),
  getAvailableAssets: async (requestId) => apiClient.get(`/requests/${requestId}/available-assets`),
  getById: async (id) => apiClient.get(`/requests/${id}`),
  create: async (data) => apiClient.post('/requests', data),
  ownerAction: async (id, data) => apiClient.put(`/requests/${id}/owner-action`, data),
  edit: async (id, data) => apiClient.put(`/requests/${id}/edit`, data),
  recall: async (id, data = {}) => apiClient.put(`/requests/${id}/recall`, data),
  returnToRequester: async (id, data) => apiClient.put(`/requests/${id}/return-to-requester`, data),
  deptAssign: async (id, data) => apiClient.put(`/requests/${id}/dept-assign`, data),
  deptAssignUpdate: async (id, data) => apiClient.put(`/requests/${id}/dept-assign-update`, data),
  sendToProcurement: async (id, data = {}) => apiClient.put(`/requests/${id}/send-to-procurement`, data),
  recallFromProcurement: async (id, data = {}) => apiClient.put(`/requests/${id}/recall-from-procurement`, data),
  inventoryAction: async (id, data) => apiClient.put(`/requests/${id}/inventory-action`, data),
  procurementAction: async (id, data) => apiClient.put(`/requests/${id}/procurement-action`, data),
  employeeAction: async (id, data) => apiClient.put(`/requests/${id}/employee-action`, data),
  employeeApprove: async (id, data) => apiClient.put(`/requests/${id}/employee-approve`, data),
};
