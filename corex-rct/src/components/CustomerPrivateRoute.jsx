import React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';

/**
 * Same job as PrivateRoute, but for the customer booking portal: an
 * unauthenticated visitor belongs on that specific org's own login page
 * (/book/:orgId/login), not the staff /login — and a logged-in customer
 * of a *different* org gets bounced to their own org's booking site
 * rather than seeing someone else's rooms.
 */
const CustomerPrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const { orgId } = useParams();

  if (loading) return <LoadingSpinner />;

  if (!user || user.role !== 'CUSTOMER') {
    return <Navigate to={`/book/${orgId}/login`} replace />;
  }
  if (String(user.organization_id) !== String(orgId)) {
    return <Navigate to={`/book/${user.organization_id}`} replace />;
  }
  return children;
};

export default CustomerPrivateRoute;
