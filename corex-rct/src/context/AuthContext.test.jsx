import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';
import { authAPI, userAPI } from '../services/api';
import { tokenStorage } from '../services/api/tokenStorage';

const admin = { id: 1, first_name: 'Alice', role: 'MSP_ADMIN' };
const orgAdmin = { id: 2, first_name: 'Bala', role: 'STP_ADMIN' };

let ctx;
const Probe = () => {
  ctx = useAuth();
  return <p data-testid="who">{ctx.user ? `${ctx.user.first_name}:${ctx.user.role}` : 'nobody'}</p>;
};

const deferred = () => {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
};

describe('AuthContext with impersonation', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
    tokenStorage.setAll({ accessToken: 'admin-token', refreshToken: 'admin-refresh', user: admin }, false);
  });
  afterEach(() => window.history.pushState({}, '', '/'));

  it('a new Impersonate tab ignores the admin session and ends up as the impersonated user', async () => {
    window.history.pushState({}, '', '/impersonate/abc');
    const me = vi.spyOn(userAPI, 'getCurrentUser');
    vi.spyOn(authAPI, 'exchangeImpersonationCode').mockResolvedValue({ data: { access: 'imp', refresh: 'imp-r', user: orgAdmin } });

    render(<AuthProvider><Probe /></AuthProvider>);
    expect(screen.getByTestId('who')).toHaveTextContent('nobody');   // admin not restored here
    expect(me).not.toHaveBeenCalled();

    await act(async () => { await ctx.loginWithImpersonationCode('abc'); });
    expect(screen.getByTestId('who')).toHaveTextContent('Bala:STP_ADMIN');
    expect(ctx.isImpersonating).toBe(true);
    expect(JSON.parse(sessionStorage.getItem('user')).id).toBe(2);
    expect(JSON.parse(localStorage.getItem('user')).id).toBe(1);      // admin's own tab untouched
  });

  it('a late /users/me answer for a different user never overwrites the current session', async () => {
    const late = deferred();
    vi.spyOn(userAPI, 'getCurrentUser').mockReturnValue(late.promise);
    vi.spyOn(authAPI, 'exchangeImpersonationCode').mockResolvedValue({ data: { access: 'imp', refresh: 'imp-r', user: orgAdmin } });

    render(<AuthProvider><Probe /></AuthProvider>);
    expect(screen.getByTestId('who')).toHaveTextContent('Alice:MSP_ADMIN');
    await act(async () => { await ctx.loginWithImpersonationCode('abc'); });
    await act(async () => { late.resolve({ data: { ...admin, first_name: 'Alice' } }); });

    await waitFor(() => expect(screen.getByTestId('who')).toHaveTextContent('Bala:STP_ADMIN'));
    expect(JSON.parse(sessionStorage.getItem('user')).id).toBe(2);
  });

  it('still refreshes the profile normally when nothing changed', async () => {
    vi.spyOn(userAPI, 'getCurrentUser').mockResolvedValue({ data: { ...admin, first_name: 'Alicia' } });
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('who')).toHaveTextContent('Alicia:MSP_ADMIN'));
    expect(JSON.parse(localStorage.getItem('user')).first_name).toBe('Alicia');
  });
});
