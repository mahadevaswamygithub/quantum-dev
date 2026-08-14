import React from 'react';
import {
  Building2, Users, Home, Settings,
  ChevronLeft, ChevronRightIcon,
  Briefcase, DollarSign, Clock, CalendarDays,
  Shield, UserCircle, History, BedDouble, CalendarCheck
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const formatRole = (role = '') =>
  role.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');

const Sidebar = ({ userRole, tenants = [], users = [], collapsed, onToggleCollapse }) => {
  const navigate = useNavigate();
  const location = useLocation();
  // Pulled from context rather than threaded in as a prop — Sidebar is
  // only ever rendered inside an authenticated page (already inside
  // AuthProvider), so this avoids touching every call site just to pass
  // one more field needed solely for vertical-specific nav visibility.
  const { user } = useAuth();
  const isRoomBookingOrg = user?.org_type === 'ROOM_BOOKING';

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');
  const isMSP = userRole === 'MSP_ADMIN' || userRole === 'MSP_USER';
  const isSTP = userRole === 'STP_ADMIN' || userRole === 'STP_USER';
  const isEmployee = userRole === 'EMPLOYEE';
  // Activity log is an audit feature — same admin-only visibility the
  // backend enforces (ActivityLogViewSet.get_queryset), so non-admins never
  // see a nav link to a page that would just come back empty for them.
  const isAdmin = userRole === 'MSP_ADMIN' || userRole === 'STP_ADMIN';
  const basePath = isMSP ? '/msp' : isSTP ? '/stp' : '/employee';

  const Tooltip = ({ label }) => (
    <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 opacity-0 shadow-lg transition-opacity group-hover:opacity-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
      {label}
    </div>
  );

  const NavItem = ({ to, icon: Icon, label, badge }) => {
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
        {!collapsed && badge !== undefined && (
          <span className="ml-auto rounded-full bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500 dark:bg-slate-700 dark:text-slate-300">
            {badge}
          </span>
        )}
        {collapsed && <Tooltip label={label} />}
      </button>
    );
  };

  return (
    <div
      className={`flex h-[calc(100vh-64px)] flex-shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-white transition-all duration-300 ease-in-out dark:border-slate-700 dark:bg-slate-800 ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Collapse Toggle */}
      <div className={`flex ${collapsed ? 'justify-center' : 'justify-end'} border-b border-slate-100 p-2 dark:border-slate-700/50`}>
        <button
          onClick={onToggleCollapse}
          className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRightIcon className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Nav Items */}
      <div className="flex-1 space-y-1 overflow-y-auto p-2">

        {/* Dashboard */}
        <NavItem to={basePath} icon={Home} label="Dashboard" />

        {/* MSP: Organizations */}
        {isMSP && (
          <NavItem to={`${basePath}/organizations`} icon={Building2} label="Organizations" badge={tenants.length} />
        )}

        {/* Users (MSP + STP) */}
        {!isEmployee && (
          <NavItem to={`${basePath}/users`} icon={Users} label="Users" badge={users.length} />
        )}

        {/* Activity Log (MSP/STP admins only) */}
        {isAdmin && (
          <NavItem to={`${basePath}/activity`} icon={History} label="Activity Log" />
        )}

        {/* Room Booking vertical — STP staff of a ROOM_BOOKING org only */}
        {isSTP && isRoomBookingOrg && (
          <>
            <NavItem to={`${basePath}/properties`} icon={Building2} label="Properties" />
            <NavItem to={`${basePath}/rooms`} icon={BedDouble} label="Rooms" />
            <NavItem to={`${basePath}/bookings`} icon={CalendarCheck} label="Bookings" />
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

        {/* Settings */}
        <NavItem to={`${basePath}/settings`} icon={Settings} label="Settings" />
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
  );
};

export default Sidebar;
