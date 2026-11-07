import React from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';

/**
 * Same job as PrivateRoute, but for the customer booking portal: an
 * unauthenticated visitor belongs on that specific org's own login page
 * (/book/:orgId/login), not the staff /login. Guest accounts work at
 * every property, so any signed-in CUSTOMER may use any property's pages.
 */
const CustomerPrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const { orgId } = useParams();
  const location = useLocation();

  if (loading) return <LoadingSpinner />;

  if (!user || user.role !== 'CUSTOMER') {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`${orgId ? `/book/${orgId}` : '/book'}/login?next=${next}`} replace />;
  }
  return children;
};

export default CustomerPrivateRoute;
