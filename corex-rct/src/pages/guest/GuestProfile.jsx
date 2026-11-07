import React from 'react';
import { Link } from 'react-router-dom';
import { Settings } from 'lucide-react';
import GuestAccountLayout from '../../components/guest/GuestAccountLayout';
import ProfileTab from '../../components/settings/ProfileTab';

/** Guest's personal details (password, theme and account deletion live in Settings). */
const GuestProfile = () => (
  <GuestAccountLayout>
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">My profile</h1>
          <p className="text-slate-500 dark:text-slate-400">Shared with the properties you book, so they can reach you about your stay.</p>
        </div>
        <Link to="/book/me/settings" className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-700 dark:text-green-400 hover:underline">
          <Settings className="w-4 h-4" /> Password &amp; security
        </Link>
      </div>
      <ProfileTab />
    </div>
  </GuestAccountLayout>
);

export default GuestProfile;
