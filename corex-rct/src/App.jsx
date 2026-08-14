import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import PrivateRoute from './components/PrivateRoute';
import ChatAssistant from './components/ChatAssistant';
import ImpersonationBanner from './components/ImpersonationBanner';

// Auth Pages
import Login from './pages/Login';
import Register from './pages/Register';
import ResetPassword from './pages/ResetPassword';
import ImpersonateSession from './pages/ImpersonateSession';

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
import MyProfile from './pages/MyProfile';
import ActivityLog from './pages/ActivityLog';
import PropertiesList from './pages/PropertiesList';
import RoomsList from './pages/RoomsList';
import BookingsList from './pages/BookingsList';

// Room-booking customer portal (public-ish, org-scoped by URL)
import BookingHome from './pages/BookingHome';
import CustomerLogin from './pages/CustomerLogin';
import CustomerRegister from './pages/CustomerRegister';
import PropertyBrowse from './pages/PropertyBrowse';
import RoomBrowse from './pages/RoomBrowse';
import RoomDetail from './pages/RoomDetail';
import MyBookings from './pages/MyBookings';
import CustomerPrivateRoute from './components/CustomerPrivateRoute';

// Employee Portal
import EmployeePortal from './pages/EmployeePortal';

const MSP_ROLES = ['MSP_ADMIN', 'MSP_USER'];
const STP_ROLES = ['STP_ADMIN', 'STP_USER'];
// Activity log is admin-only — matches ActivityLogViewSet.get_queryset on the backend.
const ADMIN_ROLES = ['MSP_ADMIN', 'STP_ADMIN'];

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
      // Without this, a logged-in CUSTOMER hitting "/" or "/login" would
      // fall to the '/login' default below, and /login's own
      // `user ? <Navigate to={defaultRoute()} /> : <Login />` would then
      // redirect straight back to itself — an infinite loop.
      case 'CUSTOMER': return `/book/${user.organization_id}`;
      default: return '/login';
    }
  };

  return (
    <Routes>
      {/* ── Public ── */}
      <Route path="/login" element={user ? <Navigate to={defaultRoute()} /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to={defaultRoute()} /> : <Register />} />
      <Route path="/reset-password/:uid/:token" element={<ResetPassword />} />
      <Route path="/impersonate/:code" element={<ImpersonateSession />} />

      {/* ── Room-booking customer portal (separate from the admin login above) ── */}
      <Route path="/book" element={<BookingHome />} />
      <Route path="/book/:orgId/login" element={<CustomerLogin />} />
      <Route path="/book/:orgId/register" element={<CustomerRegister />} />
      <Route path="/book/:orgId" element={<CustomerPrivateRoute><PropertyBrowse /></CustomerPrivateRoute>} />
      <Route path="/book/:orgId/properties/:propertyId" element={<CustomerPrivateRoute><RoomBrowse /></CustomerPrivateRoute>} />
      <Route path="/book/:orgId/properties/:propertyId/rooms/:roomId" element={<CustomerPrivateRoute><RoomDetail /></CustomerPrivateRoute>} />
      <Route path="/book/:orgId/my-bookings" element={<CustomerPrivateRoute><MyBookings /></CustomerPrivateRoute>} />

      {/* ── Shared: personal profile page (Navbar only, no Sidebar — distinct
           from the admin Settings page, which is org-management and STP/MSP
           don't share). Employee has its own equivalent at /employee/profile. */}
      <Route path="/profile" element={<PrivateRoute allowedRoles={[...MSP_ROLES, ...STP_ROLES]}><MyProfile /></PrivateRoute>} />

      {/* ── MSP ── */}
      <Route path="/msp" element={<PrivateRoute allowedRoles={MSP_ROLES}><MSPDashboard /></PrivateRoute>} />
      <Route path="/msp/organizations" element={<PrivateRoute allowedRoles={MSP_ROLES}><OrganizationsList /></PrivateRoute>} />
      <Route path="/msp/organizations/:id" element={<PrivateRoute allowedRoles={MSP_ROLES}><OrganizationDetail /></PrivateRoute>} />
      <Route path="/msp/users" element={<PrivateRoute allowedRoles={MSP_ROLES}><UsersList /></PrivateRoute>} />
      <Route path="/msp/users/:id" element={<PrivateRoute allowedRoles={MSP_ROLES}><UserDetail /></PrivateRoute>} />
      <Route path="/msp/activity" element={<PrivateRoute allowedRoles={ADMIN_ROLES}><ActivityLog /></PrivateRoute>} />
      <Route path="/msp/settings" element={<PrivateRoute allowedRoles={MSP_ROLES}><Settings /></PrivateRoute>} />

      {/* ── STP ── */}
      <Route path="/stp" element={<PrivateRoute allowedRoles={STP_ROLES}><STPDashboard /></PrivateRoute>} />
      <Route path="/stp/users" element={<PrivateRoute allowedRoles={STP_ROLES}><UsersList /></PrivateRoute>} />
      <Route path="/stp/users/:id" element={<PrivateRoute allowedRoles={STP_ROLES}><UserDetail /></PrivateRoute>} />
      <Route path="/stp/activity" element={<PrivateRoute allowedRoles={ADMIN_ROLES}><ActivityLog /></PrivateRoute>} />
      <Route path="/stp/properties" element={<PrivateRoute allowedRoles={STP_ROLES}><PropertiesList /></PrivateRoute>} />
      <Route path="/stp/rooms" element={<PrivateRoute allowedRoles={STP_ROLES}><RoomsList /></PrivateRoute>} />
      <Route path="/stp/bookings" element={<PrivateRoute allowedRoles={STP_ROLES}><BookingsList /></PrivateRoute>} />
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
      <ImpersonationBanner />
      <AppRoutes />
      {/* Org-management assistant — not relevant to EMPLOYEE (self-service
          portal) or CUSTOMER (public booking site; its tools query
          Organization/User data a customer has no access to anyway). */}
      {user && !['EMPLOYEE', 'CUSTOMER'].includes(user.role) && (
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