import React, { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Lock, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useOrgInfo } from '../hooks/useOrgInfo';
import ForgotPasswordModal from '../components/ForgotPasswordModal';
import { AuthField, AuthSubmit, GuestAuthShell, PasswordField } from '../components/guest/GuestAuthShell';

/** Only follow `next` within the booking site; default to the guest's account home. */
export const safeNext = (next) => (next && next.startsWith('/book') && !next.startsWith('//') ? next : '/book/me');

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
    <GuestAuthShell
      org={org}
      backTo={base}
      title="Welcome back"
      subtitle="Log in to book, pay and manage your trips - one account for every property."
      error={error}
      footer={<>New here? <Link to={`${base}/register?next=${encodeURIComponent(next)}`} className="font-semibold text-brand-700 dark:text-brand-400 hover:underline">Create a free account</Link></>}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <AuthField id="guest-email" label="Email" icon={Mail} type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" />
        <PasswordField
          id="guest-password"
          icon={Lock}
          autoComplete="current-password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          placeholder="Your password"
          aside={<button type="button" onClick={() => setShowForgot(true)} className="text-sm font-semibold text-brand-700 dark:text-brand-400 hover:underline">Forgot password?</button>}
        />
        <AuthSubmit loading={loading} loadingText="Logging in…">Log in</AuthSubmit>
        <p className="text-center">
          <Link to={base} className="text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">Continue browsing without logging in</Link>
        </p>
      </form>
      <ForgotPasswordModal isOpen={showForgot} onClose={() => setShowForgot(false)} />
    </GuestAuthShell>
  );
};

export default CustomerLogin;
