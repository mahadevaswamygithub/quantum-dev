/**
 * Storage abstraction so a single browser tab can hold either a normal
 * session (persisted in localStorage, shared across tabs) or an
 * impersonated session (sessionStorage, scoped to that one tab only).
 *
 * This is what lets an MSP admin open "Impersonate" in a new tab without
 * disturbing their own logged-in session in the original tab.
 */
const FLAG = 'isImpersonation';
const KEYS = ['accessToken', 'refreshToken', 'user'];

const isImpersonating = () => sessionStorage.getItem(FLAG) === '1';

export const tokenStorage = {
  isImpersonating,

  get(key) {
    return isImpersonating() ? sessionStorage.getItem(key) : localStorage.getItem(key);
  },

  /** Persist {accessToken, refreshToken, user}. impersonation=true scopes it to this tab only. */
  setAll({ accessToken, refreshToken, user }, impersonation = false) {
    const store = impersonation ? sessionStorage : localStorage;
    store.setItem('accessToken', accessToken);
    store.setItem('refreshToken', refreshToken);
    store.setItem('user', JSON.stringify(user));
    if (impersonation) sessionStorage.setItem(FLAG, '1');
  },

  /** Store a rotated pair (refresh tokens change on every refresh). */
  setTokens(accessToken, refreshToken) {
    const store = isImpersonating() ? sessionStorage : localStorage;
    store.setItem('accessToken', accessToken);
    if (refreshToken) store.setItem('refreshToken', refreshToken);
  },

  setAccessToken(token) {
    (isImpersonating() ? sessionStorage : localStorage).setItem('accessToken', token);
  },

  setUser(user, impersonation = isImpersonating()) {
    (impersonation ? sessionStorage : localStorage).setItem('user', JSON.stringify(user));
  },

  /**
   * Clears only THIS tab's active session. Deliberately does not touch the
   * other storage — an impersonated tab (sessionStorage) exiting must never
   * wipe the normal session (localStorage) that other tabs of this origin
   * are still reading, and vice versa.
   */
  clear() {
    const store = isImpersonating() ? sessionStorage : localStorage;
    KEYS.forEach((k) => store.removeItem(k));
    sessionStorage.removeItem(FLAG);
  },
};
