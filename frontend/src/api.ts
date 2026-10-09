import axios from 'axios';

// ============================================================
// ДИНАМИЧЕСКИЙ API URL
// На компьютере — 127.0.0.1, на телефоне — IP компа
// ============================================================
const getApiUrl = () => {
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://127.0.0.1:8000';
  }
  return `http://${hostname}:8000`;
};

const API_URL = getApiUrl();

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      sessionStorage.removeItem('token');
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  requestCode: (email: string) => api.post('/api/auth/request-code', { email }),
  verifyCode: (email: string, code: string, name?: string) =>
    api.post('/api/auth/verify-code', { email, code, name }),
  me: () => api.get('/api/auth/me'),
  stats: () => api.get('/api/auth/stats'),
};

export const chatAPI = {
  getChats: () => api.get('/api/chats'),
  createChat: (title = 'Новый чат') => api.post('/api/chats', { title }),
  getChat: (id: string) => api.get(`/api/chats/${id}`),
  deleteChat: (id: string) => api.delete(`/api/chats/${id}`),
  sendMessage: (chatId: string, content: string) =>
    api.post(`/api/chats/${chatId}/messages`, { content }),
};

export const photoAPI = {
  solve: (file: File, description: string = '', chatId: string = '') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('description', description);
    formData.append('chat_id', chatId);
    return api.post('/api/photo/solve', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  solveAnonymous: (file: File, description: string = '') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('description', description);
    return api.post('/api/photo/anonymous', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export const reactionAPI = {
  set: (messageId: string, reaction: 'like' | 'dislike') =>
    api.post(`/api/messages/${messageId}/reaction`, { reaction }),
  get: (messageId: string) => api.get(`/api/messages/${messageId}/reaction`),
};

export const supportAPI = {
  status: () => api.get('/api/support/status'),
  createTicket: (subject: string, content: string) =>
    api.post('/api/support/tickets', { subject, content }),
  myTickets: () => api.get('/api/support/tickets/my'),
  getTicket: (id: string) => api.get(`/api/support/tickets/${id}`),
  sendMessage: (id: string, content: string) =>
    api.post(`/api/support/tickets/${id}/messages`, { content }),
};

export const operatorAPI = {
  myTickets: () => api.get('/api/operator/tickets'),
  waitingTickets: () => api.get('/api/operator/tickets/waiting'),
  takeTicket: (id: string) => api.post(`/api/operator/tickets/${id}/take`),
  getTicket: (id: string) => api.get(`/api/operator/tickets/${id}`),
  sendMessage: (id: string, content: string) =>
    api.post(`/api/operator/tickets/${id}/messages`, { content }),
  closeTicket: (id: string) => api.patch(`/api/operator/tickets/${id}/close`),
};

export const adminAPI = {
  getUsers: () => api.get('/api/admin/users'),
  toggleOperator: (id: string) => api.patch(`/api/admin/users/${id}/operator`),
  blockUser: (id: string) => api.patch(`/api/admin/users/${id}/block`),
  getChats: () => api.get('/api/admin/chats'),
  deleteChat: (id: string) => api.delete(`/api/admin/chats/${id}`),
  getStats: () => api.get('/api/admin/stats'),
  getTickets: () => api.get('/api/admin/tickets'),
  getOperators: () => api.get('/api/admin/operators'),
};