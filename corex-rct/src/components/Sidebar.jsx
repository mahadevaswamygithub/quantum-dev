import React, { useState } from 'react';
import {
  Building2, Users, Home, Settings, ChevronDown, ChevronRight,
  Plus, UserCircle, BarChart3, ChevronLeft, ChevronRightIcon,
  Briefcase, DollarSign, Clock, CalendarDays,
  Shield
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

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

  const NavItem = ({ to, icon: Icon, label, badge }) => (
    <button
      onClick={() => navigate(to)}
      title={collapsed ? label : ''}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 group relative ${
        isActive(to)
          ? 'bg-green-500/20 text-green-400 border border-green-500/30'
          : 'text-slate-400 hover:bg-slate-700/60 hover:text-white'
      }`}
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      {!collapsed && <span className="font-medium text-sm truncate">{label}</span>}
      {!collapsed && badge !== undefined && (
        <span className="ml-auto text-xs bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded-full">
          {badge}
        </span>
      )}
      {collapsed && (
        <div className="absolute left-full ml-2 px-2 py-1 bg-slate-900 text-white text-xs rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 border border-slate-700">
          {label}
        </div>
      )}
    </button>
  );

  const SectionHeader = ({ icon: Icon, label, sectionKey, count }) => (
    <button
      onClick={() => !collapsed && toggleSection(sectionKey)}
      title={collapsed ? label : ''}
      className="w-full flex items-center justify-between px-3 py-2.5 text-slate-300 hover:bg-slate-700/60 rounded-lg transition-all group relative"
    >
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5 flex-shrink-0" />
        {!collapsed && <span className="font-medium text-sm">{label}</span>}
      </div>
      {!collapsed && (
        <div className="flex items-center gap-1.5">
          {count !== undefined && (
            <span className="text-xs bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded-full">{count}</span>
          )}
          {expandedSections[sectionKey]
            ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
          }
        </div>
      )}
      {collapsed && (
        <div className="absolute left-full ml-2 px-2 py-1 bg-slate-900 text-white text-xs rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 border border-slate-700">
          {label} {count !== undefined ? `(${count})` : ''}
        </div>
      )}
    </button>
  );

  return (
    <div
      className={`bg-slate-800 border-r border-slate-700 h-[calc(100vh-64px)] flex flex-col transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0 ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Collapse Toggle */}
      <div className={`flex ${collapsed ? 'justify-center' : 'justify-end'} p-2 border-b border-slate-700/50`}>
        <button
          onClick={onToggleCollapse}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRightIcon className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Nav Items */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">

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
              <div className="ml-3 mt-1 space-y-0.5 border-l border-slate-700 pl-2">
                {isMSP && onAddTenant && (
                  <button
                    onClick={onAddTenant}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-green-400 hover:bg-slate-700/60 rounded-lg transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Organization</span>
                  </button>
                )}
                <button
                  onClick={() => navigate(`${basePath}/organizations`)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-xs rounded-lg transition-all ${
                    isActive(`${basePath}/organizations`)
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-400 hover:bg-slate-700/60 hover:text-white'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>View All ({tenants.length})</span>
                </button>
                {tenants.slice(0, 5).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => navigate(`${basePath}/organizations/${t.id}`)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs rounded-lg transition-all ${
                      isActive(`${basePath}/organizations/${t.id}`)
                        ? 'bg-slate-700 text-white'
                        : 'text-slate-400 hover:bg-slate-700/60 hover:text-white'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span className="truncate">{t.name}</span>
                  </button>
                ))}
                {tenants.length > 5 && (
                  <p className="px-3 py-1 text-xs text-slate-600">+{tenants.length - 5} more</p>
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
              <div className="ml-3 mt-1 space-y-0.5 border-l border-slate-700 pl-2">
                <button
                  onClick={() => navigate(`${basePath}/users`)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-xs rounded-lg transition-all ${
                    isActive(`${basePath}/users`)
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-400 hover:bg-slate-700/60 hover:text-white'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>All Users ({users.length})</span>
                </button>
                {users.slice(0, 4).map((u) => (
                  <button
                    key={u.id}
                    onClick={() => navigate(`${basePath}/users/${u.id}`)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-400 hover:bg-slate-700/60 hover:text-white rounded-lg transition-all"
                  >
                    <UserCircle className="w-3.5 h-3.5" />
                    <span className="truncate">{u.first_name} {u.last_name}</span>
                  </button>
                ))}
                {users.length > 4 && (
                  <p className="px-3 py-1 text-xs text-slate-600">+{users.length - 4} more</p>
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
      {!collapsed && (
        <div className="p-3 border-t border-slate-700/50">
          <div className="flex items-center gap-2 px-2 py-1.5 bg-slate-700/50 rounded-lg">
            <Shield className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
            <span className="text-xs text-slate-400 truncate">{userRole}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;