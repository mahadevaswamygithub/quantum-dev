import React, { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useOrgInfo } from '../hooks/useOrgInfo';
import GuestLayout from '../components/guest/GuestLayout';
import ForgotPasswordModal from '../components/ForgotPasswordModal';

export const guestInputCls =
  'w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500';

/** Only follow `next` within the booking site; default to the guest's account home. */
export const safeNext = (next) => (next && next.startsWith('/book') && !next.startsWith('//') ? next : '/book/me');

export const GuestAuthCard = ({ title, subtitle, error, children, footer }) => (
  <div className="max-w-md mx-auto px-4 py-12 sm:py-16">
    <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl p-6 sm:p-8">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{title}</h1>
      {subtitle && <p className="mt-1 text-slate-500 dark:text-slate-400">{subtitle}</p>}
      {error && (
        <div className="mt-5 p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-sm text-red-700 dark:text-red-300 flex gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />{error}
        </div>
      )}
      <div className="mt-6">{children}</div>
    </div>
    {footer && <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-300">{footer}</p>}
  </div>
);

const CustomerLogin = () => {
  const { orgId } = useParams();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const base = orgId ? `/book/${orgId}` : '/book';
  const { org, notFound } = useOrgInfo(orgId);
  const { login, logout } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (result.mfa) {  // only staff accounts use two-step verification
      setError('This is a staff account. Sign in at the staff portal, or use your guest account here.');
      return;
    }
    if (!result.success) {
      setError(result.error || 'Wrong email or password.');
      return;
    }
    if (result.user.role !== 'CUSTOMER') {
      logout();
      setError('This is a staff account. Log in with your guest account, or create one to book.');
      return;
    }
    navigate(next, { replace: true });
  };

  if (notFound) {
    return <div className="min-h-screen flex items-center justify-center p-4 text-slate-500">This booking link isn’t available.</div>;
  }

  return (
    <GuestLayout org={org} bare>
      <GuestAuthCard
        title="Welcome back"
        subtitle="One account for booking at every property on CoreX."
        error={error}
        footer={<>New here? <Link to={`${base}/register?next=${encodeURIComponent(next)}`} className="font-semibold text-green-600 hover:text-green-700">Create an account</Link></>}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Email</span>
            <input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" className={`mt-1 ${guestInputCls}`} />
          </label>
          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="guest-password" className="text-sm font-medium text-slate-700 dark:text-slate-200">Password</label>
              <button type="button" onClick={() => setShowForgot(true)} className="text-sm font-medium text-green-600 hover:text-green-700 dark:text-green-400">
                Forgot password?
              </button>
            </div>
            <input id="guest-password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required className={`mt-1 ${guestInputCls}`} />
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}{loading ? 'Logging in…' : 'Log in'}
          </button>
          <p className="text-center">
            <Link to={base} className="text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">Continue browsing without logging in</Link>
          </p>
        </form>
      </GuestAuthCard>
      <ForgotPasswordModal isOpen={showForgot} onClose={() => setShowForgot(false)} />
    </GuestLayout>
  );
};

export default CustomerLogin;
