import React, { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useOrgInfo } from '../hooks/useOrgInfo';
import { bookingAPI } from '../services/api';
import GuestLayout from '../components/guest/GuestLayout';
import { GuestAuthCard, guestInputCls, safeNext } from './CustomerLogin';

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
    <GuestLayout org={org} bare>
      <GuestAuthCard
        title="Create your account"
        subtitle="Sign up once — book at any property and keep all your trips in one place."
        error={error}
        footer={<>Already have an account? <Link to={`${base}/login?next=${encodeURIComponent(next)}`} className="font-semibold text-green-600 hover:text-green-700">Log in</Link></>}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">First name</span>
              <input autoComplete="given-name" value={form.first_name} onChange={set('first_name')} required className={`mt-1 ${guestInputCls}`} />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Last name</span>
              <input autoComplete="family-name" value={form.last_name} onChange={set('last_name')} required className={`mt-1 ${guestInputCls}`} />
            </label>
          </div>
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Email</span>
            <input type="email" autoComplete="email" value={form.email} onChange={set('email')} required placeholder="you@example.com" className={`mt-1 ${guestInputCls}`} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Mobile number <span className="font-normal text-slate-400">(optional)</span></span>
            <input type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} maxLength={20} placeholder="+91 98765 43210" className={`mt-1 ${guestInputCls}`} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Password</span>
            <input type="password" autoComplete="new-password" value={form.password} onChange={set('password')} required minLength={8} placeholder="At least 8 characters" className={`mt-1 ${guestInputCls}`} />
          </label>
          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}{loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>
      </GuestAuthCard>
    </GuestLayout>
  );
};

export default CustomerRegister;
