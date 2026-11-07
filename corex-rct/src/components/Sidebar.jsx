import React, { useEffect } from 'react';
import {
  Building2, Users, Home, Settings, ChevronLeft, ChevronRightIcon, Briefcase, DollarSign, Clock, CalendarDays, Shield, UserCircle, History, BedDouble, CalendarCheck, CalendarRange, Wallet, Star, X,
} from 'lucide-react';
import { mobileNav, useMobileNavOpen } from '../hooks/useMobileNav';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';

const formatRole = (role = '') =>
  role.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');

const Sidebar = ({ userRole, collapsed: collapsedOnDesktop, onToggleCollapse }) => {
  const navigate = useNavigate();
  const location = useLocation();
  // Phones: the menu is a drawer opened by the ☰ button in the Navbar. It
  // always shows labels (the desktop "collapsed" icon rail doesn't apply).
  const drawerOpen = useMobileNavOpen();
  const collapsed = collapsedOnDesktop && !drawerOpen;
  useEffect(() => { mobileNav.close(); }, [location.pathname]);
  useEffect(() => {
    if (!drawerOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') mobileNav.close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);
  // Pulled from context rather than threaded in as a prop - Sidebar is
  // only ever rendered inside an authenticated page (already inside
  // AuthProvider), so this avoids touching every call site just to pass
  // one more field needed solely for vertical-specific nav visibility.
  const { user } = useAuth();
  const isRoomBookingOrg = user?.org_type === 'ROOM_BOOKING';
  // Staff see only what their role allows (apps.core.access → user.permissions).
  const { can, canAny, isAdmin: isOrgAdmin } = usePermissions();

  // Dashboard's `to` is basePath itself (e.g. "/msp"), which is a path
  // prefix of every other nav item ("/msp/organizations", "/msp/users", …).
  // A plain startsWith would light up Dashboard on every one of those
  // pages too, so basePath only matches exactly; every other item still
  // matches its own sub-routes (e.g. "/msp/users/5" keeps Users active).
  const isActive = (path) =>
    path === basePath
      ? location.pathname === path
      : location.pathname === path || location.pathname.startsWith(path + '/');
  const isMSP = userRole === 'MSP_ADMIN' || userRole === 'MSP_USER';
  const isSTP = userRole === 'STP_ADMIN' || userRole === 'STP_USER';
  const isEmployee = userRole === 'EMPLOYEE';
  const isPlatform = userRole === 'PLATFORM_ADMIN';
  const basePath = isPlatform ? '/platform' : isMSP ? '/msp' : isSTP ? '/stp' : '/employee';

  const Tooltip = ({ label }) => (
    <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 opacity-0 shadow-lg transition-opacity group-hover:opacity-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
      {label}
    </div>
  );

  const NavItem = ({ to, icon: Icon, label }) => {
    const active = isActive(to);
    return (
      <button
        onClick={() => navigate(to)}
        title={collapsed ? label : ''}
        className={`group relative flex w-full items-center gap-3 rounded-lg py-2.5 pl-4 pr-3 text-left transition-all duration-150 ${
          active
            ? 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700/60 dark:hover:text-white'
        }`}
      >
        {active && (
          <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-green-500" />
        )}
        <Icon className="w-[18px] h-[18px] flex-shrink-0" />
        {!collapsed && <span className="truncate text-sm font-medium">{label}</span>}
        {collapsed && <Tooltip label={label} />}
      </button>
    );
  };

  return (
    <>
    {/* Phones: dim the page behind the open drawer; tapping it closes the menu. */}
    {drawerOpen && (
      <div className="fixed inset-0 z-40 bg-slate-900/50 md:hidden" onClick={mobileNav.close} aria-hidden="true" />
    )}
    <div
      className={`flex h-full flex-shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-white transition-all duration-300 ease-in-out dark:border-slate-700 dark:bg-slate-800
        fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] shadow-2xl ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}
        md:static md:z-auto md:max-w-none md:translate-x-0 md:shadow-none ${collapsed ? 'md:w-16' : 'md:w-64'}`}
    >
      {/* Collapse toggle (desktop) / close (phone drawer) */}
      <div className={`flex ${collapsed ? 'justify-center' : 'justify-end'} border-b border-slate-100 p-2 dark:border-slate-700/50`}>
        <button
          onClick={onToggleCollapse}
          className="hidden md:block rounded-lg p-1.5 text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRightIcon className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
        <button
          onClick={mobileNav.close}
          className="md:hidden rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-700 dark:hover:text-white"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Nav Items */}
      <div className="flex-1 space-y-1 overflow-y-auto p-2">

        {/* Dashboard (the platform owner's home is the customer list) */}
        {isPlatform
          ? <NavItem to={basePath} icon={Building2} label="Customers" />
          : <NavItem to={basePath} icon={Home} label="Dashboard" />}

        {/* MSP: Organizations */}
        {isMSP && can('organizations.view') && (
          <NavItem to={`${basePath}/organizations`} icon={Building2} label="Organizations" />
        )}

        {/* Users (MSP + STP) */}
        {!isEmployee && !isPlatform && can('users.view') && (
          <NavItem to={`${basePath}/users`} icon={Users} label="Users" />
        )}

        {/* Activity Log */}
        {can('activity.view') && (
          <NavItem to={`${basePath}/activity`} icon={History} label="Activity Log" />
        )}

        {/* Room Booking vertical - STP staff of a ROOM_BOOKING org only */}
        {isSTP && isRoomBookingOrg && (
          <>
            {can('rooms.view') && <NavItem to={`${basePath}/properties`} icon={Building2} label="Properties" />}
            {can('rooms.view') && <NavItem to={`${basePath}/rooms`} icon={BedDouble} label="Rooms" />}
            {can('bookings.view') && <NavItem to={`${basePath}/bookings`} icon={CalendarCheck} label="Bookings" />}
            {can('bookings.view') && <NavItem to={`${basePath}/calendar`} icon={CalendarRange} label="Room calendar" />}
            {can('guests.view') && <NavItem to={`${basePath}/guests`} icon={UserCircle} label="Guests" />}
            {can('payments.report') && <NavItem to={`${basePath}/collections`} icon={Wallet} label="Collections" />}
            {can('reviews.view') && <NavItem to={`${basePath}/reviews`} icon={Star} label="Reviews" />}
          </>
        )}

        {/* ── Employee Portal Nav ── */}
        {isEmployee && (
          <>
            <NavItem to="/employee/profile" icon={UserCircle} label="My Profile" />
            <NavItem to="/employee/attendance" icon={Clock} label="Attendance" />
            <NavItem to="/employee/salary" icon={DollarSign} label="Salary" />
            <NavItem to="/employee/leaves" icon={CalendarDays} label="Leaves" />
            <NavItem to="/employee/documents" icon={Briefcase} label="Documents" />
          </>
        )}

        {/* Settings - organization-level; only roles with something to manage */}
        {(isOrgAdmin || canAny('settings.manage', 'platform.view', 'users.view') || (isSTP && isRoomBookingOrg && can('bookings.view'))) && (
          <NavItem to={`${basePath}/settings`} icon={Settings} label="Settings" />
        )}
      </div>

      {/* Role Badge at bottom */}
      <div className="border-t border-slate-100 p-3 dark:border-slate-700/50">
        <div className={`flex items-center gap-2 rounded-lg bg-slate-50 px-2 py-1.5 dark:bg-slate-700/50 ${collapsed ? 'justify-center' : ''}`}>
          <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-500/20">
            <Shield className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
          </div>
          {!collapsed && (
            <span className="truncate text-xs font-medium text-slate-600 dark:text-slate-400">{formatRole(userRole)}</span>
          )}
        </div>
      </div>
    </div>
    </>
  );
};

export default Sidebar;
