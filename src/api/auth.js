import { apiClient } from './client.js';

export const authApi = {
  login: async (username, password) => {
    const response = await apiClient.post('/auth/login', { username, password });
    if (response?.token) {
      apiClient.setToken(response.token);
    }
    return response;
  },

  logout: () => {
    apiClient.setToken(null);
  },

  getCurrentUser: async () => {
    return await apiClient.get('/auth/me');
  },
};
