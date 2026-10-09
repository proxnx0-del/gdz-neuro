import axios from 'axios';

const API_URL = 'http://127.0.0.1:8000';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Автоматически добавляем токен в каждый запрос
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Если 401 — выкидываем на логин
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

// ========== API-МЕТОДЫ ==========
export const authAPI = {
  requestCode: (email: string) => api.post('/api/auth/request-code', { email }),
  verifyCode: (email: string, code: string, name?: string) =>
    api.post('/api/auth/verify-code', { email, code, name }),
  me: () => api.get('/api/auth/me'),
  stats: () => api.get('/api/auth/stats'),  // ← ДОБАВЬ ЭТУ СТРОКУ
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
  solve: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/api/photo/solve', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};