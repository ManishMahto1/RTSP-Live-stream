import { apiClient } from './api';

export const streamService = {
  start: (rtspUrl, quality) => apiClient.post('/stream/start', { rtspUrl, quality }),
  stop: () => apiClient.post('/stream/stop'),
  getStatus: () => apiClient.get('/stream/status'),
  saveSettings: (data) => apiClient.post('/stream/settings', data),
  getSettings: () => apiClient.get('/stream/settings')
};