import { v4 as uuidv4 } from 'uuid';
import { authFetch } from './httpClient';

// Plain fetch (not axios) so replies can stream; authFetch renews an expired
// sign-in token the same way the rest of the app does.
export const chatAPI = {
  async streamMessage(message, sessionId, signal) {
    const validSessionId = sessionId || uuidv4();
    return authFetch('/chat/stream/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, session_id: validSessionId }),
      signal,
    });
  },
  async getHistory(sessionId) {
    if (!sessionId) return { data: { messages: [] } };
    const res = await authFetch(`/chat/sessions/${sessionId}/history/`);
    return res.json();
  },
  async clearSession(sessionId) {
    if (!sessionId) return;
    return authFetch(`/chat/sessions/${sessionId}/`, { method: 'DELETE' });
  },
};
