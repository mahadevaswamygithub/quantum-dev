import React from 'react';
import { UserCog, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Persistent banner shown only in a tab holding an impersonated session
 * (see AuthContext.isImpersonating / services/api/tokenStorage.js), so it's
 * never mistaken for the MSP admin's own login.
 */
const ImpersonationBanner = () => {
  const { user, isImpersonating, logout } = useAuth();
  const navigate = useNavigate();

  if (!isImpersonating) return null;

  const handleExit = () => {
    logout();
    window.close();
    // window.close() only works on tabs opened via script (which this always is);
    // fall back in case the browser blocks it.
    setTimeout(() => navigate('/login', { replace: true }), 150);
  };

  return (
    <div className="flex items-center justify-center gap-3 bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950">
      <UserCog className="w-4 h-4 flex-shrink-0" />
      <span>
        Impersonating <strong>{user?.first_name} {user?.last_name}</strong> ({user?.organization_name})
      </span>
      <button
        onClick={handleExit}
        className="ml-2 flex items-center gap-1 rounded-md bg-amber-950/10 px-2 py-1 hover:bg-amber-950/20 transition-colors"
      >
        <LogOut className="w-3.5 h-3.5" />
        Exit Impersonation
      </button>
    </div>
  );
};

export default ImpersonationBanner;
