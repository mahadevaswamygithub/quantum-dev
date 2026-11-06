import React from 'react';
import GuestAccountLayout from '../../components/guest/GuestAccountLayout';
import ProfileTab from '../../components/settings/ProfileTab';
import SecurityTab from '../../components/settings/SecurityTab';
import DeleteAccountCard from '../../components/guest/DeleteAccountCard';

/** Guest account page — reuses the same profile/password forms as staff Settings. */
const GuestProfile = () => (
  <GuestAccountLayout>
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Your profile</h1>
        <p className="text-slate-500 dark:text-slate-400">Shared with the properties you book, so they can reach you about your stay.</p>
      </div>
      <ProfileTab />
      <SecurityTab />
      <DeleteAccountCard />
    </div>
  </GuestAccountLayout>
);

export default GuestProfile;
