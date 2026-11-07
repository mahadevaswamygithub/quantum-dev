import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ChevronDown, LogOut, Settings as SettingsIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';
import Avatar from './common/Avatar';
import NotificationsBell from './guest/NotificationsBell';
import { usePermissions } from '../hooks/usePermissions';
import { bookingAPI } from '../services/api';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const { can } = usePermissions();

  const isMSP = user?.role === 'MSP_ADMIN' || user?.role === 'MSP_USER';
  const isSTP = user?.role === 'STP_ADMIN' || user?.role === 'STP_USER';
  // Personal profile is its own page (Settings is organization-level only).
  // Employee keeps its own portal tab.
  const isPlatform = user?.role === 'PLATFORM_ADMIN';
  const profileSettingsPath = (isMSP || isSTP || isPlatform) ? '/profile' : '/employee/profile';

  // The platform owner belongs to the internal "Public" organization: show the product name instead.
  const orgName = (!isPlatform && user?.organization_name) || 'CoreX Platform';
  const orgInitials = orgName
    .split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || 'CX';
  const portalLabel = isPlatform ? 'Platform console' : isMSP ? 'MSP Portal' : isSTP ? 'STP Portal' : user?.role === 'EMPLOYEE' ? 'Employee Portal' : '';

  const handleLogout = () => {
    setMenuOpen(false);
    logout();
    navigate('/login');
  };

  const goToProfileSettings = () => {
    setMenuOpen(false);
    navigate(profileSettingsPath);
  };

  return (
    <nav className="flex-shrink-0 border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* The user's own organization is the brand here: its logo (or
              initials) and name; CoreX stays as the small "powered by" line. */}
          <Avatar
            src={user?.organization_logo}
            initials={orgInitials}
            className="w-10 h-10 rounded-lg"
          />
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white truncate max-w-[50vw]">{orgName}</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {portalLabel}{user?.organization_name ? ' · CoreX' : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          {isSTP && user?.org_type === 'ROOM_BOOKING' && can('bookings.view') && (
            <NotificationsBell load={bookingAPI.getStaffNotifications} footer={{ to: '/stp/bookings', label: 'Open bookings' }} />
          )}

          {/* Profile menu */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="flex items-center gap-2 rounded-lg bg-slate-100 py-1.5 pl-2 pr-3 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 transition-colors"
            >
              <Avatar
                src={user?.profile_picture}
                initials={`${user?.first_name?.[0] || ''}${user?.last_name?.[0] || ''}`}
                className="w-8 h-8 rounded-full text-xs"
                bg="bg-gradient-to-br from-slate-400 to-slate-500"
              />
              <div className="hidden sm:block text-left">
                <p className="text-sm font-medium text-slate-900 dark:text-white leading-tight">
                  {user?.first_name} {user?.last_name}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-tight">{user?.email}</p>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ${menuOpen ? 'rotate-180' : ''}`} />
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)}></div>
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
                  <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-3">
                    <Avatar
                      src={user?.profile_picture}
                      initials={`${user?.first_name?.[0] || ''}${user?.last_name?.[0] || ''}`}
                      className="w-11 h-11 rounded-full text-sm"
                      bg="bg-gradient-to-br from-slate-400 to-slate-500"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {user?.first_name} {user?.last_name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user?.email}</p>
                    </div>
                  </div>

                  <div className="p-1.5">
                    <button
                      onClick={goToProfileSettings}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                      <SettingsIcon className="w-4 h-4 text-slate-400" />
                      My profile
                    </button>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
