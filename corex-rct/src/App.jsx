import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
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
import ProfilePage from './pages/ProfilePage';
import ActivityLog from './pages/ActivityLog';
import PropertiesList from './pages/PropertiesList';
import RoomsList from './pages/RoomsList';
import BookingsList from './pages/BookingsList';
import GuestsList from './pages/GuestsList';
import CollectionsPage from './pages/CollectionsPage';
import ReviewsPage from './pages/ReviewsPage';

// Room-booking customer portal (public-ish, org-scoped by URL)
import BookingHome from './pages/BookingHome';
import StaysSearch from './pages/guest/StaysSearch';
import GuestRequests from './pages/guest/GuestRequests';
import GuestWishlist from './pages/guest/GuestWishlist';
import GuestSettings from './pages/guest/GuestSettings';
import GuestHelp from './pages/guest/GuestHelp';
import GuestAbout from './pages/guest/GuestAbout';
import RoomCalendar from './pages/RoomCalendar';
import CustomerLogin from './pages/CustomerLogin';
import CustomerRegister from './pages/CustomerRegister';
import GuestHome from './pages/guest/GuestHome';
import GuestRoom from './pages/guest/GuestRoom';
import MyTrips from './pages/guest/MyTrips';
import GuestProfile from './pages/guest/GuestProfile';
import GuestDashboard from './pages/guest/GuestDashboard';
import CustomerPrivateRoute from './components/CustomerPrivateRoute';

// Employee Portal
import EmployeePortal from './pages/EmployeePortal';

const MSP_ROLES = ['MSP_ADMIN', 'MSP_USER'];
const STP_ROLES = ['STP_ADMIN', 'STP_USER'];
// Activity log is admin-only - matches ActivityLogViewSet.get_queryset on the backend.

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
      // redirect straight back to itself - an infinite loop.
      case 'CUSTOMER': return '/book/me';
      default: return '/login';
    }
  };

  return (
    <Routes>
      {/* ── Public ── */}
      {/* Staff already signed in go to their portal; a signed-in guest (e.g. "Partner login" on the
          booking site) still gets the staff login, since a guest account can't open the portal. */}
      <Route path="/login" element={user && user.role !== 'CUSTOMER' ? <Navigate to={defaultRoute()} /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to={defaultRoute()} /> : <Register />} />
      <Route path="/reset-password/:uid/:token" element={<ResetPassword />} />
      <Route path="/impersonate/:code" element={<ImpersonateSession />} />

      {/* ── Room-booking customer portal (separate from the admin login above) ── */}
      <Route path="/book" element={<BookingHome />} />
      <Route path="/book/stays" element={<StaysSearch />} />
      <Route path="/book/help" element={<GuestHelp />} />
      <Route path="/book/about" element={<GuestAbout />} />
      <Route path="/book/login" element={<CustomerLogin />} />
      <Route path="/book/register" element={<CustomerRegister />} />
      <Route path="/book/:orgId/login" element={<CustomerLogin />} />
      <Route path="/book/:orgId/register" element={<CustomerRegister />} />
      {/* The guest's own account - not tied to any one property */}
      <Route path="/book/me" element={<CustomerPrivateRoute><GuestDashboard /></CustomerPrivateRoute>} />
      <Route path="/book/me/trips" element={<CustomerPrivateRoute><MyTrips /></CustomerPrivateRoute>} />
      <Route path="/book/me/profile" element={<CustomerPrivateRoute><GuestProfile /></CustomerPrivateRoute>} />
      <Route path="/book/me/requests" element={<CustomerPrivateRoute><GuestRequests /></CustomerPrivateRoute>} />
      <Route path="/book/me/wishlist" element={<CustomerPrivateRoute><GuestWishlist /></CustomerPrivateRoute>} />
      <Route path="/book/me/settings" element={<CustomerPrivateRoute><GuestSettings /></CustomerPrivateRoute>} />
      {/* Public: anyone can browse; sign-in is asked for only at "Reserve" */}
      <Route path="/book/:orgId" element={<GuestHome />} />
      <Route path="/book/:orgId/properties/:propertyId" element={<GuestHome />} />
      <Route path="/book/:orgId/rooms/:roomId" element={<GuestRoom />} />
      <Route path="/book/:orgId/properties/:propertyId/rooms/:roomId" element={<GuestRoom />} />
      {/* Signed-in guests of this property */}
      {/* Old per-property account URLs → the shared account pages */}
      <Route path="/book/:orgId/home" element={<Navigate to="/book/me" replace />} />
      <Route path="/book/:orgId/my-bookings" element={<Navigate to="/book/me/trips" replace />} />
      <Route path="/book/:orgId/profile" element={<Navigate to="/book/me/profile" replace />} />

      {/* The signed-in staff member's own profile (Settings is organization-level). */}
      <Route path="/profile" element={<PrivateRoute allowedRoles={[...MSP_ROLES, ...STP_ROLES]}><ProfilePage /></PrivateRoute>} />

      {/* ── MSP ── */}
      <Route path="/msp" element={<PrivateRoute allowedRoles={MSP_ROLES}><MSPDashboard /></PrivateRoute>} />
      <Route path="/msp/organizations" element={<PrivateRoute allowedRoles={MSP_ROLES} perm="organizations.view"><OrganizationsList /></PrivateRoute>} />
      <Route path="/msp/organizations/:id" element={<PrivateRoute allowedRoles={MSP_ROLES} perm="organizations.view"><OrganizationDetail /></PrivateRoute>} />
      <Route path="/msp/users" element={<PrivateRoute allowedRoles={MSP_ROLES} perm="users.view"><UsersList /></PrivateRoute>} />
      <Route path="/msp/users/:id" element={<PrivateRoute allowedRoles={MSP_ROLES} perm="users.view"><UserDetail /></PrivateRoute>} />
      <Route path="/msp/activity" element={<PrivateRoute allowedRoles={MSP_ROLES} perm="activity.view"><ActivityLog /></PrivateRoute>} />
      <Route path="/msp/settings" element={<PrivateRoute allowedRoles={MSP_ROLES}><Settings /></PrivateRoute>} />

      {/* ── STP ── */}
      <Route path="/stp" element={<PrivateRoute allowedRoles={STP_ROLES}><STPDashboard /></PrivateRoute>} />
      <Route path="/stp/users" element={<PrivateRoute allowedRoles={STP_ROLES} perm="users.view"><UsersList /></PrivateRoute>} />
      <Route path="/stp/users/:id" element={<PrivateRoute allowedRoles={STP_ROLES} perm="users.view"><UserDetail /></PrivateRoute>} />
      <Route path="/stp/activity" element={<PrivateRoute allowedRoles={STP_ROLES} perm="activity.view"><ActivityLog /></PrivateRoute>} />
      <Route path="/stp/properties" element={<PrivateRoute allowedRoles={STP_ROLES} perm="rooms.view"><PropertiesList /></PrivateRoute>} />
      <Route path="/stp/rooms" element={<PrivateRoute allowedRoles={STP_ROLES} perm="rooms.view"><RoomsList /></PrivateRoute>} />
      <Route path="/stp/bookings" element={<PrivateRoute allowedRoles={STP_ROLES} perm="bookings.view"><BookingsList /></PrivateRoute>} />
      <Route path="/stp/calendar" element={<PrivateRoute allowedRoles={STP_ROLES} perm="bookings.view"><RoomCalendar /></PrivateRoute>} />
      <Route path="/stp/guests" element={<PrivateRoute allowedRoles={STP_ROLES} perm="guests.view"><GuestsList /></PrivateRoute>} />
      <Route path="/stp/collections" element={<PrivateRoute allowedRoles={STP_ROLES} perm="payments.report"><CollectionsPage /></PrivateRoute>} />
      <Route path="/stp/reviews" element={<PrivateRoute allowedRoles={STP_ROLES} perm="reviews.view"><ReviewsPage /></PrivateRoute>} />
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
  // The booking site has its own guest assistant (components/guest/GuestChat).
  const onBookingSite = useLocation().pathname.startsWith('/book');
  return (
    <>
      <ImpersonationBanner />
      <AppRoutes />
      {/* Org-management assistant - not relevant to EMPLOYEE (self-service
          portal) or CUSTOMER (public booking site; its tools query
          Organization/User data a customer has no access to anyway). */}
      {user && !onBookingSite && !['EMPLOYEE', 'CUSTOMER'].includes(user.role) && (
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