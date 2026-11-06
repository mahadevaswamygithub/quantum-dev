import React, { useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Building2, CalendarCheck, Globe2, KeyRound, Mail } from 'lucide-react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import OrganizationTab from '../components/settings/OrganizationTab';
import BookingSiteTab from '../components/settings/BookingSiteTab';
import PlatformTab from '../components/settings/PlatformTab';
import RolesTab from '../components/settings/RolesTab';
import EmailTab from '../components/settings/EmailTab';

const ADMIN_ROLES = ['MSP_ADMIN', 'STP_ADMIN'];
const has = (u, ...codes) => codes.some(c => (u.permissions || []).includes(c));

/** Every tab, with who may see it (apps.core.access permissions). Order here is the order in the nav. */
const ALL_TABS = [
  {
    id: 'organization', group: 'Organization', label: 'Organization', icon: Building2, component: OrganizationTab,
    show: (u) => has(u, 'settings.manage'),
  },
  {
    id: 'email', group: 'Organization', label: 'Email', icon: Mail, component: EmailTab,
    show: (u) => has(u, 'settings.manage'),
  },
  {
    id: 'booking', group: 'Organization', label: 'Booking Site', icon: CalendarCheck, component: BookingSiteTab,
    show: (u) => u.org_type === 'ROOM_BOOKING' && ['STP_ADMIN', 'STP_USER'].includes(u.role) && has(u, 'bookings.view', 'settings.manage'),
  },
  {
    id: 'roles', group: 'Organization', label: 'Roles & access', icon: KeyRound, component: RolesTab,
    show: (u) => ADMIN_ROLES.includes(u.role) || has(u, 'users.view'),
  },
  {
    id: 'platform', group: 'Platform', label: 'Platform', icon: Globe2, component: PlatformTab,
    show: (u) => has(u, 'platform.view'),
  },
];

const Settings = () => {
  const { user } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const tabs = ALL_TABS.filter(t => t.show(user));
  const requested = searchParams.get('tab');
  // Personal settings moved to My profile; nothing organization-level for this role.
  if (['profile', 'security', 'appearance'].includes(requested) || tabs.length === 0) {
    return <Navigate to="/profile" replace />;
  }
  const active = tabs.find(t => t.id === requested) || tabs[0];
  const groups = [...new Set(tabs.map(t => t.group))];
  const ActiveComponent = active.component;

  const selectTab = (id) => setSearchParams({ tab: id }, { replace: true });

  return (
    <div className="h-screen overflow-hidden bg-slate-50 dark:bg-slate-900 flex flex-col">
      <Navbar />

      <div className="flex flex-1 min-h-0">
        <Sidebar
          userRole={user.role}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(p => !p)}
        />

        <main className="flex-1 overflow-y-auto min-h-0">
          <div className="w-full px-4 sm:px-6 py-6">
            <header className="mb-6">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Settings</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Settings for {user?.organization_name || 'your organization'}. Your own details are under My profile (top right).
              </p>
            </header>

            <div className="flex flex-col lg:flex-row gap-6">
              {/* Section nav: horizontal scroller on small screens, grouped column on large */}
              <nav aria-label="Settings sections" className="lg:w-52 flex-shrink-0">
                <div className="flex lg:flex-col gap-1 overflow-x-auto -mx-4 px-4 lg:mx-0 lg:px-0 pb-1 lg:pb-0">
                  {groups.map(group => (
                    <div key={group} className="contents lg:block lg:mb-4">
                      {groups.length > 1 && (
                        <p className="hidden lg:block px-3 mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                          {group}
                        </p>
                      )}
                      {tabs.filter(t => t.group === group).map(({ id, label, icon: Icon }) => {
                        const isActive = active.id === id;
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => selectTab(id)}
                            aria-current={isActive ? 'page' : undefined}
                            className={`flex items-center gap-2.5 w-full whitespace-nowrap px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                              isActive
                                ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                          >
                            <Icon className="w-4 h-4 flex-shrink-0" />
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </nav>

              <div className="flex-1 min-w-0">
                {/* key resets each tab's form state when switching tabs */}
                <ActiveComponent key={active.id} />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Settings;
