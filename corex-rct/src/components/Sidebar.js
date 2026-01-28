import React, { useState } from 'react';
import { 
  Building2, 
  Users, 
  Home, 
  Settings, 
  ChevronDown, 
  ChevronRight,
  Plus,
  UserCircle,
  BarChart3
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

const Sidebar = ({ userRole, tenants = [], users = [], onAddTenant }) => {
  const [expandedSections, setExpandedSections] = useState({
    tenants: true,
    users: true,
  });
  const navigate = useNavigate();
  const location = useLocation();

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const isActive = (path) => location.pathname === path;
  const isMSP = userRole === 'MSP_ADMIN' || userRole === 'MSP_USER';
  const isGreenAdmin = userRole === 'GREEN_ADMIN';
  const basePath = isGreenAdmin ? '/green-admin' : isMSP ? '/msp' : '/stp';

  return (
    <div className="w-64 bg-slate-800 border-r border-slate-700 h-[calc(100vh-72px)] overflow-y-auto">
      <div className="p-4 space-y-2">
        {/* Dashboard Link */}
        <button
          onClick={() => navigate(basePath)}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
            isActive(basePath)
              ? 'bg-green-500 text-white'
              : 'text-slate-300 hover:bg-slate-700'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="font-medium">Dashboard</span>
        </button>

        {/* Tenants Section (MSP & Green Admin) */}
        {(isMSP || isGreenAdmin) && (
          <div className="mt-4">
            <button
              onClick={() => toggleSection('tenants')}
              className="w-full flex items-center justify-between px-4 py-3 text-slate-300 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <div className="flex items-center gap-3">
                <Building2 className="w-5 h-5" />
                <span className="font-medium">
                  {isGreenAdmin ? 'All Organizations' : 'Tenants'}
                </span>
              </div>
              {expandedSections.tenants ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>

            {expandedSections.tenants && (
              <div className="ml-4 mt-2 space-y-1">
                {/* Add Tenant Button (MSP only) */}
                {isMSP && onAddTenant && (
                  <button
                    onClick={onAddTenant}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-green-400 hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Tenant</span>
                  </button>
                )}

                {/* View All Tenants */}
                <button
                  onClick={() => navigate(`${basePath}/tenants`)}
                  className={`w-full flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors ${
                    isActive(`${basePath}/tenants`)
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>View All ({tenants.length})</span>
                </button>

                {/* Tenant List */}
                {tenants.slice(0, 5).map((tenant) => (
                  <button
                    key={tenant.id}
                    onClick={() => navigate(`${basePath}/tenants/${tenant.id}`)}
                    className={`w-full flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors ${
                      isActive(`${basePath}/tenants/${tenant.id}`)
                        ? 'bg-slate-700 text-white'
                        : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    <Building2 className="w-4 h-4" />
                    <span className="truncate">{tenant.name}</span>
                  </button>
                ))}

                {tenants.length > 5 && (
                  <p className="px-4 py-2 text-xs text-slate-500">
                    +{tenants.length - 5} more
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Users Section */}
        <div className="mt-4">
          <button
            onClick={() => toggleSection('users')}
            className="w-full flex items-center justify-between px-4 py-3 text-slate-300 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5" />
              <span className="font-medium">Users</span>
            </div>
            {expandedSections.users ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>

          {expandedSections.users && (
            <div className="ml-4 mt-2 space-y-1">
              {/* View All Users */}
              <button
                onClick={() => navigate(`${basePath}/users`)}
                className={`w-full flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors ${
                  isActive(`${basePath}/users`)
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>All Users ({users.length})</span>
              </button>

              {/* User List Preview (First 5) */}
              {users.slice(0, 5).map((user) => (
                <button
                  key={user.id}
                  onClick={() => navigate(`${basePath}/users/${user.id}`)}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-400 hover:bg-slate-700 hover:text-white rounded-lg transition-colors"
                >
                  <UserCircle className="w-4 h-4" />
                  <span className="truncate">{user.first_name} {user.last_name}</span>
                </button>
              ))}

              {users.length > 5 && (
                <p className="px-4 py-2 text-xs text-slate-500">
                  +{users.length - 5} more users
                </p>
              )}
            </div>
          )}
        </div>

        {/* Settings */}
        <button
          onClick={() => navigate(`${basePath}/settings`)}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
            isActive(`${basePath}/settings`)
              ? 'bg-green-500 text-white'
              : 'text-slate-300 hover:bg-slate-700'
          }`}
        >
          <Settings className="w-5 h-5" />
          <span className="font-medium">Settings</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;