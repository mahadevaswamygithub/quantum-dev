import React from 'react';
import { Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/**
 * Staff of an account that signed up and is waiting for CoreX's approval:
 * they can set everything up, but guests can't see or book their hotels yet.
 * (Suspended / closed accounts never get this far: they can't sign in.)
 */
const AccountStatusBanner = () => {
  const { user } = useAuth();
  if (!user || user.account_status !== 'PENDING') return null;
  return (
    <div className="flex items-center justify-center gap-2 bg-amber-50 px-4 py-2 text-center text-sm text-amber-800 border-b border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20">
      <Clock className="w-4 h-4 flex-shrink-0" />
      <span>
        Your account is waiting for approval by CoreX. Set up your rooms now; guests will see your hotels once it’s approved.
      </span>
    </div>
  );
};

export default AccountStatusBanner;
