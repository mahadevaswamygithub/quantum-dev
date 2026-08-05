import { v4 as uuidv4 } from 'uuid';
import { API_BASE_URL } from './httpClient';

export const chatAPI = {
  async streamMessage(message, sessionId) {
    const validSessionId = sessionId || uuidv4();
    const token = localStorage.getItem('accessToken');
    return fetch(`${API_BASE_URL}/chat/stream/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' },
      body: JSON.stringify({ message, session_id: validSessionId }),
    });
  },
  async getHistory(sessionId) {
    if (!sessionId) return { data: { messages: [] } };
    const token = localStorage.getItem('accessToken');
    const res = await fetch(`${API_BASE_URL}/chat/sessions/${sessionId}/history/`, {
      headers: { Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' },
    });
    return res.json();
  },
  async clearSession(sessionId) {
    if (!sessionId) return;
    const token = localStorage.getItem('accessToken');
    return fetch(`${API_BASE_URL}/chat/sessions/${sessionId}/`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  },
};
