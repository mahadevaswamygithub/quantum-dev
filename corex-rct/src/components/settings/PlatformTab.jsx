import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, CreditCard, Mail, RefreshCw, Server, XCircle } from 'lucide-react';
import { tenantAPI } from '../../services/api';
import { orgTypeLabel } from '../../constants/orgTypes';
import { ErrorCard, LoadingCard, SettingsCard, apiErrorMessage } from './settingsUi';

const INTEGRATIONS = [
  {
    key: 'payments', label: 'Online payments (Razorpay)', icon: CreditCard,
    ok: 'Customers can pay for bookings online.',
    fix: 'Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in the backend .env, then restart Django.',
  },
  {
    key: 'email', label: 'Email (SMTP)', icon: Mail,
    ok: 'Password-reset and invite emails can be sent.',
    fix: 'Set EMAIL_HOST_USER and EMAIL_HOST_PASSWORD in the backend .env, then restart Django.',
  },
  {
    key: 'background_tasks', label: 'Background tasks (Redis)', icon: Server,
    ok: 'Redis is reachable.',
    fix: 'Start Redis (docker start corex-redis) and the Celery worker. See README → Redis + Celery.',
  },
];

const Stat = ({ label, value, sub }) => (
  <div className="rounded-lg bg-slate-50 dark:bg-slate-700/50 p-4">
    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
    <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white tabular-nums">{value}</p>
    {sub && <p className="text-xs text-slate-500 dark:text-slate-400">{sub}</p>}
  </div>
);

const PlatformTab = () => {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const { data } = await tenantAPI.getPlatformStatus();
      setStatus(data);
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load platform status'));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (error && !status) return <ErrorCard message={error} />;
  if (!status) return <LoadingCard />;

  const { organizations: orgs, integrations } = status;
  const byType = Object.entries(orgs.by_type || {});

  return (
    <div className="space-y-6">
      <SettingsCard title="Organizations you manage">
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <Stat label="Organizations" value={orgs.total} sub={`${orgs.active} active`} />
          <Stat label="Inactive" value={orgs.total - orgs.active} />
          <Stat label="Staff users" value={status.users} />
          <Stat label="Booking customers" value={status.customers} />
        </div>
        {byType.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-2">
            {byType.map(([type, n]) => (
              <li key={type} className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-700 dark:text-green-400">
                {orgTypeLabel(type)} · {n}
              </li>
            ))}
          </ul>
        )}
        {orgs.missing_type > 0 && (
          <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-sm text-amber-800 dark:text-amber-300">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>
              {orgs.missing_type} organization{orgs.missing_type > 1 ? 's have' : ' has'} no business type, so {orgs.missing_type > 1 ? 'their' : 'its'} staff
              can't use Room Booking. Open it from{' '}
              <Link to="/msp/organizations" className="underline font-medium">Organizations</Link>, edit, and save.
            </span>
          </div>
        )}
      </SettingsCard>

      <SettingsCard
        title="Integrations"
        description="What the product depends on, checked live from the server."
        actions={
          <button
            type="button"
            onClick={load}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /> Recheck
          </button>
        }
      >
        <ul className="divide-y divide-slate-100 dark:divide-slate-700">
          {INTEGRATIONS.map(({ key, label, icon: Icon, ok, fix }) => {
            const up = integrations[key];
            return (
              <li key={key} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <Icon className="w-5 h-5 mt-0.5 text-slate-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{label}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{up ? ok : fix}</p>
                </div>
                <span className={`inline-flex items-center gap-1 text-xs font-medium flex-shrink-0 ${up ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {up ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  {up ? 'Working' : 'Not set up'}
                </span>
              </li>
            );
          })}
        </ul>
      </SettingsCard>
    </div>
  );
};

export default PlatformTab;
