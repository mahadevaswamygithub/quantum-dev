import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/**
 * Bootstrap route for `/impersonate/:code`, opened in a fresh browser tab
 * by the "Impersonate" action on an STP organization. Exchanges the
 * one-time code for real JWTs (scoped to sessionStorage — see
 * AuthContext.loginWithImpersonationCode / services/api/tokenStorage.js)
 * and lands on that user's normal portal route.
 */
const ImpersonateSession = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const { loginWithImpersonationCode, getPortalRoute } = useAuth();
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await loginWithImpersonationCode(code);
      if (cancelled) return;
      if (result.success) {
        navigate(getPortalRoute(), { replace: true });
      } else {
        setError(result.error);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8 text-center">
        {error ? (
          <>
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Can't open this session</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">{error}</p>
            <Link to="/login" className="text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 font-semibold text-sm">
              Go to Login
            </Link>
          </>
        ) : (
          <>
            <Loader2 className="w-10 h-10 text-green-500 mx-auto mb-4 animate-spin" />
            <p className="text-slate-500 dark:text-slate-400 text-sm">Signing you in…</p>
          </>
        )}
      </div>
    </div>
  );
};

export default ImpersonateSession;
