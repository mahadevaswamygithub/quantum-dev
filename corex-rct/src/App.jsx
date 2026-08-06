import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import PrivateRoute from './components/PrivateRoute';
import ChatAssistant from './components/ChatAssistant';

// Auth Pages
import Login from './pages/Login';
import Register from './pages/Register';
import ResetPassword from './pages/ResetPassword';

// MSP Pages
import MSPDashboard from './pages/MSPDashboard';

// STP Pages
import STPDashboard from './pages/STPDashboard';

// Shared Pages
import UsersList from './pages/UsersList';
import UserDetail from './pages/UserDetail';
import OrganizationsList from './pages/OrganizationsList';
import OrganizationDetail from './pages/OrganizationDetail';
import Settings from './pages/Settings';

// Employee Portal
import EmployeePortal from './pages/EmployeePortal';

const MSP_ROLES = ['MSP_ADMIN', 'MSP_USER'];
const STP_ROLES = ['STP_ADMIN', 'STP_USER'];

const AppRoutes = () => {
  const { user } = useAuth();

  const defaultRoute = () => {
    if (!user) return '/login';
    switch (user.role) {
      case 'MSP_ADMIN':
      case 'MSP_USER': return '/msp';
      case 'STP_ADMIN':
      case 'STP_USER': return '/stp';
      case 'EMPLOYEE': return '/employee';
      default: return '/login';
    }
  };

  return (
    <Routes>
      {/* ── Public ── */}
      <Route path="/login" element={user ? <Navigate to={defaultRoute()} /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to={defaultRoute()} /> : <Register />} />
      <Route path="/reset-password/:uid/:token" element={<ResetPassword />} />

      {/* ── MSP ── */}
      <Route path="/msp" element={<PrivateRoute allowedRoles={MSP_ROLES}><MSPDashboard /></PrivateRoute>} />
      <Route path="/msp/organizations" element={<PrivateRoute allowedRoles={MSP_ROLES}><OrganizationsList /></PrivateRoute>} />
      <Route path="/msp/organizations/:id" element={<PrivateRoute allowedRoles={MSP_ROLES}><OrganizationDetail /></PrivateRoute>} />
      <Route path="/msp/users" element={<PrivateRoute allowedRoles={MSP_ROLES}><UsersList /></PrivateRoute>} />
      <Route path="/msp/users/:id" element={<PrivateRoute allowedRoles={MSP_ROLES}><UserDetail /></PrivateRoute>} />
      <Route path="/msp/settings" element={<PrivateRoute allowedRoles={MSP_ROLES}><Settings /></PrivateRoute>} />

      {/* ── STP ── */}
      <Route path="/stp" element={<PrivateRoute allowedRoles={STP_ROLES}><STPDashboard /></PrivateRoute>} />
      <Route path="/stp/users" element={<PrivateRoute allowedRoles={STP_ROLES}><UsersList /></PrivateRoute>} />
      <Route path="/stp/users/:id" element={<PrivateRoute allowedRoles={STP_ROLES}><UserDetail /></PrivateRoute>} />
      <Route path="/stp/settings" element={<PrivateRoute allowedRoles={STP_ROLES}><Settings /></PrivateRoute>} />

      {/* ── Employee Portal ── */}
      <Route path="/employee" element={<PrivateRoute allowedRoles={['EMPLOYEE']}><EmployeePortal /></PrivateRoute>} />
      <Route path="/employee/profile" element={<PrivateRoute allowedRoles={['EMPLOYEE']}><EmployeePortal defaultTab="profile" /></PrivateRoute>} />
      <Route path="/employee/attendance" element={<PrivateRoute allowedRoles={['EMPLOYEE']}><EmployeePortal defaultTab="attendance" /></PrivateRoute>} />
      <Route path="/employee/salary" element={<PrivateRoute allowedRoles={['EMPLOYEE']}><EmployeePortal defaultTab="salary" /></PrivateRoute>} />
      <Route path="/employee/leaves" element={<PrivateRoute allowedRoles={['EMPLOYEE']}><EmployeePortal defaultTab="leaves" /></PrivateRoute>} />
      <Route path="/employee/documents" element={<PrivateRoute allowedRoles={['EMPLOYEE']}><EmployeePortal defaultTab="documents" /></PrivateRoute>} />

      {/* ── Default ── */}
      <Route path="/" element={<Navigate to={defaultRoute()} />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
};

const AppWithChat = () => {
  const { user } = useAuth();
  return (
    <>
      <AppRoutes />
      {user && !['EMPLOYEE'].includes(user.role) && (
        <ChatAssistant sessionId={`session_${user.id}`} user={{ role: user.role }} />
      )}
    </>
  );
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <AppWithChat />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;