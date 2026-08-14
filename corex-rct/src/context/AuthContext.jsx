import React, { createContext, useState, useContext, useEffect } from 'react';
import { authAPI } from '../services/api';
import { tokenStorage } from '../services/api/tokenStorage';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isImpersonating, setIsImpersonating] = useState(tokenStorage.isImpersonating());

  useEffect(() => {
    const storedUser = tokenStorage.get('user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        tokenStorage.clear();
      }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const response = await authAPI.login({ email, password });
      const { access, refresh, user: userData } = response.data;
      tokenStorage.setAll({ accessToken: access, refreshToken: refresh, user: userData }, false);
      setUser(userData);
      setIsImpersonating(false);
      return { success: true, user: userData };
    } catch (error) {
      return { success: false, error: error.response?.data?.error || 'Login failed' };
    }
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

  const getPortalRoute = () => {
    if (!user) return '/login';
    switch (user.role) {
      case 'MSP_ADMIN':
      case 'MSP_USER': return '/msp';
      case 'STP_ADMIN':
      case 'STP_USER': return '/stp';
      case 'EMPLOYEE': return '/employee';
      case 'CUSTOMER': return `/book/${user.organization_id}`;
      default: return '/';
    }
  };

  return (
    <AuthContext.Provider value={{
      user, loading, login, loginWithImpersonationCode, register, logout, updateUser, setSession,
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