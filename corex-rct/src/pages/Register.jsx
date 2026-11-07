import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Building2, CheckCircle, AlertCircle, Loader2, Hotel, Network, Phone, User } from 'lucide-react';
import { authAPI } from '../services/api';
import AuthBackground from '../components/AuthBackground';

const INPUT = 'w-full pl-11 pr-4 py-3 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500';
const LABEL = 'block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2';

const ACCOUNT_TYPES = [
  { value: 'STP', icon: Hotel, title: 'My hotel business', text: 'One business with one or more properties. Most hotels choose this.' },
  { value: 'MSP', icon: Network, title: 'A hotel group', text: 'You run several separate hotel businesses, each with its own manager.' },
];

const Field = ({ label, icon: Icon, ...props }) => (
  <div>
    <label className={LABEL}>{label}</label>
    <div className="relative">
      <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
      <input className={INPUT} {...props} />
    </div>
  </div>
);

/**
 * "List your hotels on CoreX": creates a customer account that waits for
 * CoreX's approval. No password here: we email a link to set one, which also
 * confirms the email address.
 */
const Register = () => {
  const [signupOpen, setSignupOpen] = useState(null);
  useEffect(() => {
    authAPI.signupStatus().then(({ data }) => setSignupOpen(!!data.enabled)).catch(() => setSignupOpen(false));
  }, []);
  const [form, setForm] = useState({ account_type: 'STP', organization_name: '', first_name: '', last_name: '', email: '', phone: '' });
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);
  const [loading, setLoading] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await authAPI.register(form);
      setDone(data);
    } catch (err) {
      const d = err.response?.data;
      setError(typeof d === 'object' && d ? (d.error || Object.values(d).flat().join(' ')) : 'Sign-up failed. Please try again.');
    } finally { setLoading(false); }
  };

  if (signupOpen === false) {
    return (
      <AuthBackground>
        <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8 text-center">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Sign-up is closed</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-6">
            New hotels are set up by the CoreX team. Contact us and we'll create your account; you'll get an email to set your password.
          </p>
          <Link to="/login" className="font-semibold text-green-600 hover:text-green-700">Back to sign in</Link>
        </div>
      </AuthBackground>
    );
  }

  if (done) {
    return (
      <AuthBackground>
        <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8 text-center animate-pop-in">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Check your email</h2>
          <p className="text-slate-600 dark:text-slate-300 mb-4">
            We sent a link to <strong>{done.email}</strong>. Open it to set your password and sign in.
          </p>
          <ol className="text-left text-sm text-slate-500 dark:text-slate-400 space-y-2 mb-6 list-decimal pl-5">
            <li>Set your password from the email.</li>
            <li>Sign in and add your rooms, photos and prices.</li>
            <li>CoreX reviews your account. Once approved, guests can find and book your hotel.</li>
          </ol>
          <Link to="/login" className="font-semibold text-green-600 hover:text-green-700">Go to sign in</Link>
        </div>
      </AuthBackground>
    );
  }

  return (
    <AuthBackground>
      <div className="w-full max-w-2xl py-8">
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-green-400 to-blue-500 rounded-2xl flex items-center justify-center mb-4">
            <span className="text-2xl font-bold text-white">CX</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">List your hotels on CoreX</h1>
          <p className="text-slate-500 dark:text-slate-400">Bookings, rooms, payments and guests in one place.</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-lg flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <span className={LABEL}>What are you signing up?</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {ACCOUNT_TYPES.map(({ value, icon: Icon, title, text }) => (
                  <button key={value} type="button" onClick={() => setForm((f) => ({ ...f, account_type: value }))}
                    className={`flex gap-3 text-left rounded-xl border p-4 transition-all ${form.account_type === value
                      ? 'border-green-500 bg-green-50 ring-1 ring-green-500 dark:bg-green-500/10'
                      : 'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600'}`}>
                    <Icon className={`w-6 h-6 flex-shrink-0 ${form.account_type === value ? 'text-green-600' : 'text-slate-400'}`} />
                    <span>
                      <span className="block font-semibold text-slate-900 dark:text-white">{title}</span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">{text}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <Field label={form.account_type === 'MSP' ? 'Group name' : 'Business name'} icon={Building2}
              value={form.organization_name} onChange={set('organization_name')} required placeholder="Green Stays" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="First name" icon={User} value={form.first_name} onChange={set('first_name')} required placeholder="Ravi" />
              <Field label="Last name" icon={User} value={form.last_name} onChange={set('last_name')} required placeholder="Kumar" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Work email" icon={Mail} type="email" value={form.email} onChange={set('email')} required placeholder="you@yourhotel.com" />
              <Field label="Phone (optional)" icon={Phone} type="tel" value={form.phone} onChange={set('phone')} placeholder="+91 98765 43210" />
            </div>

            <button type="submit" disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? <><Loader2 className="w-5 h-5 animate-spin" />Creating your account...</> : 'Create account'}
            </button>
            <p className="text-xs text-center text-slate-500 dark:text-slate-400">
              We'll email you a link to set your password. Your hotels go live after a quick review by CoreX.
            </p>
          </form>

          <div className="mt-6 text-center">
            <p className="text-slate-500 dark:text-slate-400">
              Already on CoreX?{' '}
              <Link to="/login" className="text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 font-semibold">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </AuthBackground>
  );
};

export default Register;
