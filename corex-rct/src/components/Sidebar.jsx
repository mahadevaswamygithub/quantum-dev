import React, { useState } from 'react';
import {
  Building2, Users, Home, Settings, ChevronDown, ChevronRight,
  Plus, UserCircle, BarChart3, ChevronLeft, ChevronRightIcon,
  Briefcase, DollarSign, Clock, CalendarDays,
  Shield
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

const formatRole = (role = '') =>
  role.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');

const Sidebar = ({ userRole, tenants = [], users = [], onAddTenant, collapsed, onToggleCollapse }) => {
  const [expandedSections, setExpandedSections] = useState({ tenants: true, users: false });
  const navigate = useNavigate();
  const location = useLocation();

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');
  const isMSP = userRole === 'MSP_ADMIN' || userRole === 'MSP_USER';
  const isSTP = userRole === 'STP_ADMIN' || userRole === 'STP_USER';
  const isEmployee = userRole === 'EMPLOYEE';
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

  const SectionHeader = ({ icon: Icon, label, sectionKey, count }) => (
    <button
      onClick={() => !collapsed && toggleSection(sectionKey)}
      title={collapsed ? label : ''}
      className="group relative flex w-full items-center justify-between rounded-lg px-4 py-2.5 text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-700 dark:text-slate-300 dark:hover:bg-slate-700/60 dark:hover:text-white"
    >
      <div className="flex items-center gap-3">
        <Icon className="w-[18px] h-[18px] flex-shrink-0" />
        {!collapsed && <span className="text-sm font-medium">{label}</span>}
      </div>
      {!collapsed && (
        <div className="flex items-center gap-1.5">
          {count !== undefined && (
            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500 dark:bg-slate-700 dark:text-slate-400">{count}</span>
          )}
          {expandedSections[sectionKey]
            ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
            : <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
          }
        </div>
      )}
      {collapsed && <Tooltip label={count !== undefined ? `${label} (${count})` : label} />}
    </button>
  );

  const subItemClass = (active) =>
    `flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs transition-all ${
      active
        ? 'bg-slate-100 text-slate-900 dark:bg-slate-700 dark:text-white'
        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700/60 dark:hover:text-white'
    }`;

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

        {/* ── MSP: Organizations ── */}
        {isMSP && (
          <div>
            <SectionHeader
              icon={Building2}
              label="Organizations"
              sectionKey="tenants"
              count={tenants.length}
            />
            {expandedSections.tenants && !collapsed && (
              <div className="ml-4 mt-1 space-y-0.5 border-l border-slate-200 pl-2 dark:border-slate-700">
                {onAddTenant && (
                  <button
                    onClick={onAddTenant}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-green-600 transition-all hover:bg-green-50 dark:text-green-400 dark:hover:bg-slate-700/60"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Organization</span>
                  </button>
                )}
                <button
                  onClick={() => navigate(`${basePath}/organizations`)}
                  className={subItemClass(isActive(`${basePath}/organizations`))}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>View All ({tenants.length})</span>
                </button>
                {tenants.slice(0, 5).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => navigate(`${basePath}/organizations/${t.id}`)}
                    className={subItemClass(isActive(`${basePath}/organizations/${t.id}`))}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span className="truncate">{t.name}</span>
                  </button>
                ))}
                {tenants.length > 5 && (
                  <p className="px-3 py-1 text-xs text-slate-400 dark:text-slate-600">+{tenants.length - 5} more</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Users Section ── */}
        {!isEmployee && (
          <div>
            <SectionHeader icon={Users} label="Users" sectionKey="users" count={users.length} />
            {expandedSections.users && !collapsed && (
              <div className="ml-4 mt-1 space-y-0.5 border-l border-slate-200 pl-2 dark:border-slate-700">
                <button
                  onClick={() => navigate(`${basePath}/users`)}
                  className={subItemClass(isActive(`${basePath}/users`))}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>All Users ({users.length})</span>
                </button>
                {users.slice(0, 4).map((u) => (
                  <button
                    key={u.id}
                    onClick={() => navigate(`${basePath}/users/${u.id}`)}
                    className={subItemClass(false)}
                  >
                    <UserCircle className="w-3.5 h-3.5" />
                    <span className="truncate">{u.first_name} {u.last_name}</span>
                  </button>
                ))}
                {users.length > 4 && (
                  <p className="px-3 py-1 text-xs text-slate-400 dark:text-slate-600">+{users.length - 4} more</p>
                )}
              </div>
            )}
          </div>
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
