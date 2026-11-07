import React, { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Lock, Mail, Phone, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useOrgInfo } from '../hooks/useOrgInfo';
import { bookingAPI } from '../services/api';
import { AuthField, AuthSubmit, GuestAuthShell, PasswordField } from '../components/guest/GuestAuthShell';
import { safeNext } from './CustomerLogin';

const CustomerRegister = () => {
  const { orgId } = useParams();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const base = orgId ? `/book/${orgId}` : '/book';
  const { org, notFound } = useOrgInfo(orgId);
  const { setSession } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // Guests sign in with their email, so it doubles as the username.
      const { data } = await bookingAPI.registerCustomer({ ...form, username: form.email, organization_id: orgId || null });
      setSession(data.access, data.refresh, data.user);
      navigate(next, { replace: true });
    } catch (err) {
      const errs = err.response?.data || {};
      setError(errs.email?.[0] || errs.username?.[0] || errs.password?.[0] || errs.phone?.[0] || errs.organization_id?.[0] || 'Could not create your account.');
    } finally {
      setLoading(false);
    }
  };

  if (notFound) {
    return <div className="min-h-screen flex items-center justify-center p-4 text-slate-500">This booking link isn’t available.</div>;
  }

  return (
    <GuestAuthShell
      org={org}
      backTo={base}
      title="Create your account"
      subtitle="Sign up once - book at any property and keep all your trips in one place."
      error={error}
      footer={<>Already have an account? <Link to={`${base}/login?next=${encodeURIComponent(next)}`} className="font-semibold text-brand-700 dark:text-brand-400 hover:underline">Log in</Link></>}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <AuthField id="reg-first" label="First name" icon={User} autoComplete="given-name" value={form.first_name} onChange={set('first_name')} required />
          <AuthField id="reg-last" label="Last name" icon={User} autoComplete="family-name" value={form.last_name} onChange={set('last_name')} required />
        </div>
        <AuthField id="reg-email" label="Email" icon={Mail} type="email" autoComplete="email" value={form.email} onChange={set('email')} required placeholder="you@example.com" />
        <AuthField id="reg-phone" label="Mobile number" hint="(optional)" icon={Phone} type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} maxLength={20} placeholder="+91 98765 43210" />
        <PasswordField id="reg-password" icon={Lock} meter autoComplete="new-password" value={form.password} onChange={set('password')} required minLength={8} placeholder="At least 8 characters" />
        <AuthSubmit loading={loading} loadingText="Creating account…">Create account</AuthSubmit>
        <p className="text-center text-xs text-slate-400">Your details are shared only with the property you book.</p>
      </form>
    </GuestAuthShell>
  );
};

export default CustomerRegister;
