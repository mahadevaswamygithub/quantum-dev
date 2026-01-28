import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';

// Auth Pages
import Login from './pages/Login';
import Register from './pages/Register';
import ResetPassword from './pages/ResetPassword';

// Green Admin Pages
import GreenAdminDashboard from './pages/GreenAdminDashboard';

// MSP Pages
import MSPDashboard from './pages/MSPDashboard';

// STP Pages
import STPDashboard from './pages/STPDashboard';

// Shared Pages
import UsersList from './pages/UsersList';
import TenantsList from './pages/TenantsList';
import TenantDetail from './pages/TenantDetail';

const AppRoutes = () => {
  const { user } = useAuth();

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/" /> : <Register />} />
      <Route path="/reset-password/:uid/:token" element={<ResetPassword />} />
      
      {/* Green Admin Routes */}
      <Route
        path="/green-admin"
        element={
          <PrivateRoute allowedRoles={['GREEN_ADMIN']}>
            <GreenAdminDashboard />
          </PrivateRoute>
        }
      />
      <Route
        path="/green-admin/tenants"
        element={
          <PrivateRoute allowedRoles={['GREEN_ADMIN']}>
            <TenantsList />
          </PrivateRoute>
        }
      />
      <Route
        path="/green-admin/tenants/:id"
        element={
          <PrivateRoute allowedRoles={['GREEN_ADMIN']}>
            <TenantDetail />
          </PrivateRoute>
        }
      />
      <Route
        path="/green-admin/users"
        element={
          <PrivateRoute allowedRoles={['GREEN_ADMIN']}>
            <UsersList />
          </PrivateRoute>
        }
      />
      
      {/* MSP Routes */}
      <Route
        path="/msp"
        element={
          <PrivateRoute allowedRoles={['MSP_ADMIN', 'MSP_USER']}>
            <MSPDashboard />
          </PrivateRoute>
        }
      />
      <Route
        path="/msp/tenants"
        element={
          <PrivateRoute allowedRoles={['MSP_ADMIN', 'MSP_USER']}>
            <TenantsList />
          </PrivateRoute>
        }
      />
      <Route
        path="/msp/tenants/:id"
        element={
          <PrivateRoute allowedRoles={['MSP_ADMIN', 'MSP_USER']}>
            <TenantDetail />
          </PrivateRoute>
        }
      />
      <Route
        path="/msp/users"
        element={
          <PrivateRoute allowedRoles={['MSP_ADMIN', 'MSP_USER']}>
            <UsersList />
          </PrivateRoute>
        }
      />
      
      {/* STP Routes */}
      <Route
        path="/stp"
        element={
          <PrivateRoute allowedRoles={['STP_ADMIN', 'STP_USER']}>
            <STPDashboard />
          </PrivateRoute>
        }
      />
      <Route
        path="/stp/users"
        element={
          <PrivateRoute allowedRoles={['STP_ADMIN', 'STP_USER']}>
            <UsersList />
          </PrivateRoute>
        }
      />
      
      {/* Default Route */}
      <Route path="/" element={<Navigate to={user ? (
        user.role === 'GREEN_ADMIN' ? '/green-admin' :
        ['MSP_ADMIN', 'MSP_USER'].includes(user.role) ? '/msp' :
        '/stp'
      ) : '/login'} />} />
      
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;