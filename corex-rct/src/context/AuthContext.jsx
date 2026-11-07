import React, { createContext, useState, useContext, useEffect } from 'react';
import { authAPI, userAPI } from '../services/api';
import { tokenStorage } from '../services/api/tokenStorage';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isImpersonating, setIsImpersonating] = useState(tokenStorage.isImpersonating());

  useEffect(() => {
    // A fresh tab opened by "Impersonate" must not restore (or refresh) the
    // admin's own session from localStorage - ImpersonateSession is about to
    // put the impersonated session in this tab, and a late /users/me answer
    // for the admin would overwrite it.
    if (window.location.pathname.startsWith('/impersonate/') && !tokenStorage.isImpersonating()) {
      setLoading(false);
      return;
    }
    const storedUser = tokenStorage.get('user');
    if (!storedUser) {
      setLoading(false);
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(storedUser);
    } catch {
      tokenStorage.clear();
      setLoading(false);
      return;
    }
    setUser(parsed);
    // Refresh from the server so role/permission changes made since this
    // session started take effect on the next page load (the stored copy is
    // only as fresh as the last login).
    userAPI.getCurrentUser()
      .then(({ data }) => {
        // Only apply it if this tab is still signed in as the same person -
        // the session may have changed (login, impersonation) while it loaded.
        let current = null;
        try { current = JSON.parse(tokenStorage.get('user') || 'null'); } catch { /* ignore */ }
        if (!current || current.id !== data.id) return;
        const fresh = { ...current, ...data };
        setUser(fresh);
        tokenStorage.setUser(fresh, tokenStorage.isImpersonating());
      })
      .catch(() => { /* offline or token expired: keep the stored copy; the API interceptor handles 401s */ })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    try {
      const response = await authAPI.login({ email, password });
      // Password OK but a two-step code (or first-time setup) is needed.
      if (response.data.mfa_required || response.data.mfa_setup_required) {
        return { success: false, mfa: { step: response.data.mfa_required ? 'verify' : 'setup', token: response.data.mfa_token } };
      }
      return { success: true, user: completeLogin(response.data) };
    } catch (error) {
      return { success: false, error: error.response?.data?.error || 'Login failed' };
    }
  };

  /** Store tokens + user from a successful sign-in response (login, 2FA step). */
  const completeLogin = ({ access, refresh, user: userData }) => {
    tokenStorage.setAll({ accessToken: access, refreshToken: refresh, user: userData }, false);
    setUser(userData);
    setIsImpersonating(false);
    return userData;
  };

  /** Exchanges a one-time impersonation code for a tab-scoped session (sessionStorage). */
  const loginWithImpersonationCode = async (code) => {
    try {
      const response = await authAPI.exchangeImpersonationCode(code);
      const { access, refresh, user: userData } = response.data;
      tokenStorage.setAll({ accessToken: access, refreshToken: refresh, user: userData }, true);
      setUser(userData);
      setIsImpersonating(true);
      return { success: true, user: userData };
    } catch (error) {
      return { success: false, error: error.response?.data?.error || 'This impersonation link is invalid.' };
    }
  };

  const register = async (formData) => {
    try {
      const response = await authAPI.register(formData);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data || 'Registration failed' };
    }
  };

  const logout = () => {
    authAPI.logout();
    setUser(null);
    setIsImpersonating(false);
  };

  /** Used by customer self-registration (apps.bookings' register endpoint
   * returns tokens directly, same shape as login) to sign the new customer
   * straight in without a second round trip through authAPI.login. */
  const setSession = (access, refresh, userData) => {
    tokenStorage.setAll({ accessToken: access, refreshToken: refresh, user: userData }, false);
    setUser(userData);
    setIsImpersonating(false);
  };

  const updateUser = (updatedData) => {
    const newUser = { ...user, ...updatedData };
    setUser(newUser);
    tokenStorage.setUser(newUser, isImpersonating);
  };

  /** Home route for `who` (defaults to the signed-in user). */
  const getPortalRoute = (who = user) => {
    if (!who) return '/login';
    switch (who.role) {
      case 'PLATFORM_ADMIN': return '/platform';
      case 'MSP_ADMIN':
      case 'MSP_USER': return '/msp';
      case 'STP_ADMIN':
      case 'STP_USER': return '/stp';
      case 'EMPLOYEE': return '/employee';
      case 'CUSTOMER': return '/book/me';
      default: return '/';
    }
  };

  return (
    <AuthContext.Provider value={{
      user, loading, login, completeLogin, loginWithImpersonationCode, register, logout, updateUser, setSession,
      getPortalRoute, isAuthenticated: !!user, isImpersonating,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};