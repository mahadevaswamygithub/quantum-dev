import React, { useState } from 'react';
import { 
  Building2, 
  Users, 
  Home, 
  Settings, 
  ChevronDown, 
  ChevronRight,
  Plus,
  UserCircle
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
  const isSTP = userRole === 'STP_ADMIN' || userRole === 'STP_USER';

  return (
    <div className="w-64 bg-slate-800 border-r border-slate-700 h-[calc(100vh-72px)] overflow-y-auto">
      <div className="p-4 space-y-2">
        {/* Dashboard Link */}
        <button
          onClick={() => navigate(isMSP ? '/msp' : '/stp')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
            isActive(isMSP ? '/msp' : '/stp')
              ? 'bg-green-500 text-white'
              : 'text-slate-300 hover:bg-slate-700'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="font-medium">Dashboard</span>
        </button>

        {/* MSP: Tenants Section */}
        {isMSP && (
          <div className="mt-4">
            <button
              onClick={() => toggleSection('tenants')}
              className="w-full flex items-center justify-between px-4 py-3 text-slate-300 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <div className="flex items-center gap-3">
                <Building2 className="w-5 h-5" />
                <span className="font-medium">Tenants</span>
              </div>
              {expandedSections.tenants ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>

            {expandedSections.tenants && (
              <div className="ml-4 mt-2 space-y-1">
                {/* Add Tenant Button */}
                <button
                  onClick={onAddTenant}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-green-400 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Tenant</span>
                </button>

                {/* Tenant List */}
                {tenants.length === 0 ? (
                  <p className="px-4 py-2 text-xs text-slate-500">No tenants yet</p>
                ) : (
                  tenants.map((tenant) => (
                    <button
                      key={tenant.id}
                      onClick={() => navigate(`/msp/tenants/${tenant.id}`)}
                      className={`w-full flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors ${
                        isActive(`/msp/tenants/${tenant.id}`)
                          ? 'bg-slate-700 text-white'
                          : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                      }`}
                    >
                      <Building2 className="w-4 h-4" />
                      <span className="truncate">{tenant.name}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* Users Section (Both MSP and STP) */}
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
                onClick={() => navigate(isMSP ? '/msp/users' : '/stp/users')}
                className={`w-full flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors ${
                  isActive(isMSP ? '/msp/users' : '/stp/users')
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
                  onClick={() => navigate(`${isMSP ? '/msp' : '/stp'}/users/${user.id}`)}
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
          onClick={() => navigate(isMSP ? '/msp/settings' : '/stp/settings')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
            isActive(isMSP ? '/msp/settings' : '/stp/settings')
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