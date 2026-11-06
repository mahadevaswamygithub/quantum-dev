import { useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

const ADMIN_TIERS = ['MSP_ADMIN', 'STP_ADMIN'];

/**
 * Staff permission checks for showing/hiding nav, pages and buttons.
 * `user.permissions` comes from the API (apps.core.access) — admins already
 * receive every code for their portal, so `can()` needs no special case;
 * `isAdmin` is only for admin-only screens such as editing roles.
 * The API enforces the same codes, so hiding something here is never the
 * only protection.
 */
export const usePermissions = () => {
  const { user } = useAuth();
  const perms = user?.permissions || [];
  const can = useCallback((code) => perms.includes(code), [perms]);
  const canAny = useCallback((...codes) => codes.some(c => perms.includes(c)), [perms]);
  return { can, canAny, isAdmin: ADMIN_TIERS.includes(user?.role), permissions: perms };
};
