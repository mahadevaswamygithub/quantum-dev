import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import GreenAdminDashboard from './pages/GreenAdminDashboard';
import MSPDashboard from './pages/MSPDashboard';
import STPDashboard from './pages/STPDashboard';
import UsersList from './pages/UsersList';

const AppRoutes = () => {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/" /> : <Register />} />
      
      <Route
        path="/green-admin"
        element={
          <PrivateRoute allowedRoles={['GREEN_ADMIN']}>
            <GreenAdminDashboard />
          </PrivateRoute>
        }
      />
      
      <Route
        path="/msp"
        element={
          <PrivateRoute allowedRoles={['MSP_ADMIN', 'MSP_USER']}>
            <MSPDashboard />
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