import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';

const portalHome = (role) => (
  role?.startsWith('MSP') ? '/msp' : role?.startsWith('STP') ? '/stp' : role === 'EMPLOYEE' ? '/employee' : '/login'
);

/**
 * `allowedRoles`: which user tiers may open the page at all.
 * `perm`: a permission code (or array — any one is enough) the user's role
 * must grant (apps.core.access). Without it they're sent to their portal's
 * dashboard instead of a dead end. The API enforces the same rules.
 */
const PrivateRoute = ({ children, allowedRoles, perm }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={portalHome(user.role)} replace />;
  }

  if (perm) {
    const needed = Array.isArray(perm) ? perm : [perm];
    const have = user.permissions || [];
    if (!needed.some(p => have.includes(p))) {
      return <Navigate to={portalHome(user.role)} replace />;
    }
  }

  return children;
};

export default PrivateRoute;
