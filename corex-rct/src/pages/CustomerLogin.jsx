import React, { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Mail, Lock, AlertCircle, Loader2, BedDouble } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useOrgInfo } from '../hooks/useOrgInfo';
import AuthBackground from '../components/AuthBackground';
import Avatar from '../components/common/Avatar';

const CustomerLogin = () => {
  const { orgId } = useParams();
  const { org, loading: orgLoading, notFound } = useOrgInfo(orgId);
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await login(email, password);
    if (result.success) {
      if (result.user.role !== 'CUSTOMER' || String(result.user.organization_id) !== String(orgId)) {
        setError('This account is not a guest account for this property.');
      } else {
        navigate(`/book/${orgId}`);
      }
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  if (orgLoading) return null;
  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 text-center">
        <p className="text-slate-500 dark:text-slate-400">This booking link isn't available.</p>
      </div>
    );
  }

  return (
    <AuthBackground>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Avatar src={org.logo} icon={BedDouble} className="w-16 h-16 rounded-2xl mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">{org.name}</h1>
          <p className="text-slate-500 dark:text-slate-400">Sign in to book a room</p>
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
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com"
                  className="w-full pl-11 pr-4 py-3 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••"
                  className="w-full pl-11 pr-4 py-3 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50">
              {loading ? <><Loader2 className="w-5 h-5 animate-spin" />Signing in...</> : 'Sign In'}
            </button>
          </form>
          <div className="mt-6 text-center">
            <p className="text-slate-500 dark:text-slate-400">
              New here?{' '}
              <Link to={`/book/${orgId}/register`} className="text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 font-semibold">
                Create an account
              </Link>
            </p>
          </div>
        </div>
      </div>
    </AuthBackground>
  );
};

export default CustomerLogin;
