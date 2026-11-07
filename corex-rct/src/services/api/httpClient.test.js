import axios from 'axios';
import { authFetch } from './httpClient';

// The chat streams replies with fetch(), outside axios. Its sign-in token
// must be renewed the same way, or the chat breaks 15 minutes after sign-in.
describe('authFetch', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('accessToken', 'old-access');
    localStorage.setItem('refreshToken', 'refresh-1');
  });
  afterEach(() => vi.restoreAllMocks());

  it('renews an expired token once and retries the request', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('', { status: 401 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    vi.spyOn(axios, 'post').mockResolvedValue({ data: { access: 'new-access', refresh: 'refresh-2' } });

    const res = await authFetch('/chat/stream/', { method: 'POST', body: '{}' });

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer old-access');
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer new-access');
    expect(localStorage.getItem('refreshToken')).toBe('refresh-2');   // rotated token kept
  });

  it('passes other responses straight through without renewing', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('busy', { status: 503 }));
    const post = vi.spyOn(axios, 'post');
    const res = await authFetch('/chat/stream/');
    expect(res.status).toBe(503);
    expect(post).not.toHaveBeenCalled();
  });
});
