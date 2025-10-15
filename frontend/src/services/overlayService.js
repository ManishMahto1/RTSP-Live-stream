import { apiClient } from './api';

export const overlayService = {
  getAll: () => apiClient.get('/overlays'),
  getById: (id) => apiClient.get(`/overlays/${id}`),
  create: (data) => apiClient.post('/overlays', data),
  update: (id, data) => apiClient.put(`/overlays/${id}`, data),
  delete: (id) => apiClient.delete(`/overlays/${id}`)
};