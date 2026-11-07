import React, { useState } from 'react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import ProfileTab from '../components/settings/ProfileTab';
import SecurityTab from '../components/settings/SecurityTab';
import TwoFactorCard from '../components/settings/TwoFactorCard';

/**
 * The signed-in staff member's own page (top-right menu → My profile):
 * photo, personal details and password (theme is in the top bar). Organization-wide options
 * live separately in Settings.
 */
const ProfilePage = () => {
  const { user } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="h-screen overflow-hidden bg-slate-50 dark:bg-slate-900 flex flex-col">
      <Navbar />
      <div className="flex flex-1 min-h-0">
        <Sidebar userRole={user.role} collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(p => !p)} />
        <main className="flex-1 overflow-y-auto min-h-0">
          <div className="w-full px-4 sm:px-6 py-6">
            <header className="mb-6">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">My profile</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">Your personal details, password and two-step verification.</p>
            </header>
            <div className="grid gap-6 xl:grid-cols-2 items-start">
              <ProfileTab />
              <div className="space-y-6">
                <SecurityTab />
                <TwoFactorCard />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ProfilePage;
