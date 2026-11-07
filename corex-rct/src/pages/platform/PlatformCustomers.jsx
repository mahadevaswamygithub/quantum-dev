import React, { useCallback, useEffect, useState } from 'react';
import {
  Building2, Plus, Search, CheckCircle2, PauseCircle, PlayCircle, XCircle, Clock, Hotel, Mail, Loader2, Users, CalendarCheck,
} from 'lucide-react';
import Navbar from '../../components/Navbar';
import Sidebar from '../../components/Sidebar';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import EmptyState from '../../components/common/EmptyState';
import PageSpinner from '../../components/common/PageSpinner';
import RefreshButton from '../../components/common/RefreshButton';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { useAuth } from '../../context/AuthContext';
import { platformAPI } from '../../services/api';

const STATUS = {
  PENDING: { label: 'Waiting for approval', tone: 'amber', icon: Clock },
  ACTIVE: { label: 'Active', tone: 'green', icon: CheckCircle2 },
  SUSPENDED: { label: 'Suspended', tone: 'red', icon: PauseCircle },
  CLOSED: { label: 'Closed', tone: 'slate', icon: XCircle },
};
const TABS = [['', 'All'], ['PENDING', 'Waiting'], ['ACTIVE', 'Active'], ['SUSPENDED', 'Suspended'], ['CLOSED', 'Closed']];
const INPUT = 'w-full px-3 py-2.5 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500';
const LABEL = 'block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5';

const typeLabel = (t) => (t === 'MSP' ? 'Hotel group' : 'Single business');
const hotelsLabel = (c) => (c.account_type === 'MSP' ? 'hotels' : 'properties');
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '-');
const errorText = (err, fallback) => {
  const d = err?.response?.data;
  if (!d) return fallback;
  if (typeof d === 'string') return fallback;
  if (d.error) return Array.isArray(d.error) ? d.error.join(' ') : d.error;
  return Object.values(d).flat().join(' ') || fallback;
};

const StatusBadge = ({ status }) => {
  const s = STATUS[status] || STATUS.ACTIVE;
  return <Badge tone={s.tone} icon={s.icon}>{s.label}</Badge>;
};

/* ── New customer (created active; the admin gets a set-password email) ── */
const NewCustomerModal = ({ isOpen, onClose, onCreated }) => {
  const empty = { account_type: 'STP', name: '', first_name: '', last_name: '', email: '', phone: '', property_limit: '' };
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (isOpen) { setForm(empty); setError(''); } }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const { data } = await platformAPI.create({ ...form, property_limit: form.property_limit === '' ? null : Number(form.property_limit) });
      onCreated(data);
      onClose();
    } catch (err) {
      setError(errorText(err, 'Could not create the customer.'));
    } finally { setSaving(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New customer">
      <form onSubmit={submit} className="p-5 space-y-4">
        {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-600 dark:text-red-400 text-sm">{error}</div>}
        <div className="grid grid-cols-2 gap-2">
          {[['STP', 'Single business', 'Their hotels are properties'], ['MSP', 'Hotel group', 'Each hotel has its own manager']].map(([v, t, d]) => (
            <button key={v} type="button" onClick={() => setForm((f) => ({ ...f, account_type: v }))}
              className={`text-left rounded-xl border p-3 transition-all ${form.account_type === v
                ? 'border-green-500 bg-green-50 dark:bg-green-500/10' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}>
              <div className="text-sm font-semibold text-slate-900 dark:text-white">{t}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{d}</div>
            </button>
          ))}
        </div>
        <div>
          <label className={LABEL}>Business name *</label>
          <input className={INPUT} value={form.name} onChange={set('name')} required placeholder="Green Stays" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={LABEL}>Admin first name *</label><input className={INPUT} value={form.first_name} onChange={set('first_name')} required /></div>
          <div><label className={LABEL}>Admin last name *</label><input className={INPUT} value={form.last_name} onChange={set('last_name')} required /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={LABEL}>Admin email *</label><input type="email" className={INPUT} value={form.email} onChange={set('email')} required /></div>
          <div><label className={LABEL}>Phone</label><input className={INPUT} value={form.phone} onChange={set('phone')} /></div>
        </div>
        <div>
          <label className={LABEL}>Hotel limit</label>
          <input type="number" min="1" className={INPUT} value={form.property_limit} onChange={set('property_limit')} placeholder="No limit" />
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">The account is active straight away. The admin gets an email to set their password.</p>
        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" disabled={saving}>{saving ? <><Loader2 className="w-4 h-4 animate-spin" />Creating...</> : 'Create customer'}</Button>
        </div>
      </form>
    </Modal>
  );
};

/* ── One customer: details, hotels, limit and status actions ── */
const CustomerModal = ({ customerId, onClose, onChanged }) => {
  const [c, setC] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [limit, setLimit] = useState('');
  const [pending, setPending] = useState(null); // 'suspend' | 'close' waiting for a reason
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    try {
      const { data } = await platformAPI.get(customerId);
      setC(data);
      setLimit(data.property_limit ?? '');
    } catch (err) { setError(errorText(err, 'Could not load this customer.')); }
  }, [customerId]);
  useEffect(() => { if (customerId) { setC(null); setError(''); setPending(null); setReason(''); load(); } }, [customerId, load]);

  const run = async (key, fn) => {
    setBusy(key);
    setError('');
    try {
      await fn();
      await load();
      onChanged();
      setPending(null);
      setReason('');
    } catch (err) { setError(errorText(err, 'That didn’t work.')); }
    finally { setBusy(''); }
  };
  const act = (action, why = '') => run(action, () => platformAPI.setStatus(customerId, action, why));
  const [notice, setNotice] = useState('');
  useEffect(() => { setNotice(''); }, [customerId]);
  const resendWelcome = () => run('welcome', async () => {
    const { data } = await platformAPI.resendWelcome(customerId);
    setNotice(`Welcome email sent to ${data.sent.join(', ')}.`);
  });
  const saveLimit = () => run('limit', () => platformAPI.setLimit(customerId, limit === '' ? null : Number(limit)));

  return (
    <Modal isOpen={!!customerId} onClose={onClose} title={c ? c.name : 'Customer'} wide>
      <div className="p-5 space-y-5">
        {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-600 dark:text-red-400 text-sm">{error}</div>}
        {!c ? (
          !error && <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={c.status} />
              <Badge tone={c.account_type === 'MSP' ? 'purple' : 'blue'}>{typeLabel(c.account_type)}</Badge>
              {c.signed_up && <Badge tone="slate">Signed up online</Badge>}
              <span className="text-xs text-slate-500 dark:text-slate-400">Since {fmtDate(c.created_on)}</span>
            </div>
            {c.status_reason && c.status !== 'ACTIVE' && (
              <p className="text-sm text-slate-600 dark:text-slate-300"><span className="font-medium">Reason:</span> {c.status_reason}</p>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[[Hotel, `${c.property_count}${c.property_limit ? ` / ${c.property_limit}` : ''}`, hotelsLabel(c)],
                [Users, c.staff, 'staff accounts'],
                [CalendarCheck, c.bookings_30d, 'bookings, 30 days'],
                [Mail, c.admins.length, c.admins.length === 1 ? 'admin' : 'admins']].map(([Icon, v, l]) => (
                <div key={l} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                  <Icon className="w-4 h-4 text-slate-400 mb-1" />
                  <div className="text-lg font-bold text-slate-900 dark:text-white">{v}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{l}</div>
                </div>
              ))}
            </div>

            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Admins</h3>
              <ul className="divide-y divide-slate-100 dark:divide-slate-700 rounded-xl border border-slate-200 dark:border-slate-700">
                {c.admins.map((a) => (
                  <li key={a.email} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2 text-sm">
                    <span className="min-w-0 break-all text-slate-900 dark:text-white">{a.name || a.email}<span className="text-slate-500 dark:text-slate-400"> · {a.email}</span></span>
                    <span className={`text-xs ${a.invite_pending ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'}`}>
                      {a.invite_pending ? 'Hasn’t set a password yet' : a.last_login ? `Last sign-in ${fmtDate(a.last_login)}` : 'Hasn’t signed in yet'}
                    </span>
                  </li>
                ))}
                {!c.admins.length && <li className="px-3 py-2 text-sm text-slate-500">No active admin.</li>}
              </ul>
              {c.admins.some((a) => a.invite_pending) && (
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <Button variant="secondary" icon={Mail} disabled={!!busy} onClick={resendWelcome}>
                    {busy === 'welcome' ? 'Sending...' : 'Resend welcome email'}
                  </Button>
                  <span className="text-xs text-slate-500 dark:text-slate-400">Sends a new set-password link.</span>
                </div>
              )}
              {notice && <p className="mt-2 text-sm text-green-700 dark:text-green-400">{notice}</p>}
            </section>

            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">{c.account_type === 'MSP' ? 'Hotels' : 'Properties'}</h3>
              {c.hotels.length ? (
                <ul className="divide-y divide-slate-100 dark:divide-slate-700 rounded-xl border border-slate-200 dark:border-slate-700">
                  {c.hotels.map((h) => (
                    <li key={h.id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <span className="text-slate-900 dark:text-white">{h.name}</span>
                      <span className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        {h.rooms} room{h.rooms === 1 ? '' : 's'}
                        {!h.is_active && <Badge tone="slate">Off</Badge>}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-slate-500 dark:text-slate-400">None added yet.</p>}
            </section>

            <section className="flex flex-wrap items-end gap-3">
              <div>
                <label className={LABEL}>Hotel limit</label>
                <input type="number" min="1" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="No limit" className={`${INPUT} w-36`} />
              </div>
              <Button variant="secondary" onClick={saveLimit} disabled={busy === 'limit' || String(limit) === String(c.property_limit ?? '')}>
                {busy === 'limit' ? 'Saving...' : 'Save limit'}
              </Button>
            </section>

            <section className="border-t border-slate-200 dark:border-slate-700 pt-4">
              {pending ? (
                <div className="space-y-3">
                  <label className={LABEL}>Reason (sent to the customer)</label>
                  <textarea rows={2} className={INPUT} value={reason} onChange={(e) => setReason(e.target.value)}
                    placeholder={pending === 'suspend' ? 'e.g. Invoice for October is unpaid' : 'e.g. Customer asked to close the account'} />
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => setPending(null)}>Back</Button>
                    <Button variant="danger" disabled={!!busy} onClick={() => act(pending, reason)}>
                      {busy ? 'Working...' : pending === 'suspend' ? 'Suspend account' : 'Close account'}
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Staff are signed out at once and the hotels disappear from the booking site. Bookings are kept.
                  </p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {c.status === 'PENDING' && <Button icon={CheckCircle2} disabled={!!busy} onClick={() => act('approve')}>{busy === 'approve' ? 'Approving...' : 'Approve'}</Button>}
                  {['SUSPENDED', 'CLOSED'].includes(c.status) && <Button icon={PlayCircle} disabled={!!busy} onClick={() => act('reactivate')}>{busy === 'reactivate' ? 'Working...' : 'Reactivate'}</Button>}
                  {['PENDING', 'ACTIVE'].includes(c.status) && <Button variant="secondary" icon={PauseCircle} onClick={() => setPending('suspend')}>Suspend</Button>}
                  {c.status !== 'CLOSED' && <Button variant="ghost" icon={XCircle} onClick={() => setPending('close')}>Close account</Button>}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </Modal>
  );
};

const PlatformCustomers = () => {
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState(null);
  const [showNew, setShowNew] = useState(false);

  // Search runs on the server; wait for a short pause in typing.
  useEffect(() => { const t = setTimeout(() => setQuery(search.trim()), 300); return () => clearTimeout(t); }, [search]);

  const fetchData = useCallback(async () => {
    try {
      const [list, sum] = await Promise.all([
        platformAPI.list({ ...(tab && { status: tab }), ...(query && { search: query }) }),
        platformAPI.summary(),
      ]);
      setRows(list.data || []);
      setSummary(sum.data);
    } catch (err) {
      console.error(err);
    } finally { setLoading(false); }
  }, [tab, query]);
  useEffect(() => { fetchData(); }, [fetchData]);
  const live = useAutoRefresh(fetchData);

  if (loading) return <PageSpinner label="Loading..." />;
  const waiting = summary?.by_status?.PENDING || 0;

  return (
    <div className="h-screen overflow-hidden bg-slate-50 dark:bg-slate-900 flex flex-col">
      <Navbar />
      <div className="flex flex-1 min-h-0">
        <Sidebar userRole={user.role} collapsed={collapsed} onToggleCollapse={() => setCollapsed((p) => !p)} />
        <main className="flex-1 overflow-y-auto min-h-0 p-3 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Customers</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {summary?.total ?? 0} accounts · {summary?.live_hotels ?? 0} hotels live on the booking site · {summary?.new_30d ?? 0} new in 30 days
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button icon={Plus} onClick={() => setShowNew(true)}>New customer</Button>
              <RefreshButton onClick={live.refresh} refreshing={live.refreshing} lastUpdated={live.lastUpdated} />
            </div>
          </div>

          {waiting > 0 && tab !== 'PENDING' && (
            <button onClick={() => setTab('PENDING')}
              className="mb-5 w-full flex items-center gap-3 rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-left text-sm text-amber-800 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
              <Clock className="w-4 h-4 flex-shrink-0" />
              <span><strong>{waiting}</strong> sign-up{waiting === 1 ? '' : 's'} waiting for your approval. Review them</span>
            </button>
          )}

          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="flex max-w-full gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
              {TABS.map(([v, l]) => (
                <button key={v || 'all'} onClick={() => setTab(v)}
                  className={`whitespace-nowrap px-3 py-1.5 rounded-md text-sm font-medium transition-all ${tab === v
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}>
                  {l}{v && summary?.by_status?.[v] ? <span className="ml-1.5 text-xs text-slate-400">{summary.by_status[v]}</span> : null}
                </button>
              ))}
            </div>
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or admin email"
                className={`${INPUT} pl-9 py-2`} />
            </div>
          </div>

          {rows.length === 0 ? (
            <EmptyState icon={Building2} title="No customers here"
              description={tab === 'PENDING' ? 'No sign-ups are waiting for approval.' : 'Try another filter, or create a customer.'} />
          ) : (
            <>
            {/* Phones: one card per customer. */}
            <ul className="md:hidden space-y-3">
              {rows.map((c) => (
                <li key={c.id}>
                  <button onClick={() => setOpenId(c.id)}
                    className="w-full text-left rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800 active:bg-slate-50 dark:active:bg-slate-700/40">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900 dark:text-white truncate">{c.name}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{typeLabel(c.account_type)}{c.signed_up ? ' · signed up online' : ''}</div>
                      </div>
                      <StatusBadge status={c.status} />
                    </div>
                    {c.admin && <div className="mt-2 text-sm text-slate-600 dark:text-slate-300 truncate">{c.admin.name} · {c.admin.email}</div>}
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {c.property_count}{c.property_limit ? ` of ${c.property_limit}` : ''} {hotelsLabel(c)} · since {fmtDate(c.created_on)}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
            <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900/40 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Customer</th>
                    <th className="px-4 py-3 font-semibold">Admin</th>
                    <th className="px-4 py-3 font-semibold">Hotels</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Since</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {rows.map((c) => (
                    <tr key={c.id} onClick={() => setOpenId(c.id)} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/40">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900 dark:text-white">{c.name}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{typeLabel(c.account_type)}{c.signed_up ? ' · signed up online' : ''}</div>
                      </td>
                      <td className="px-4 py-3">
                        {c.admin ? (
                          <>
                            <div className="text-slate-900 dark:text-white">{c.admin.name}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">{c.admin.email}{c.admin.invite_pending ? ' · password not set yet' : ''}</div>
                          </>
                        ) : <span className="text-slate-400">-</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                        {c.property_count}{c.property_limit ? <span className="text-slate-400"> / {c.property_limit}</span> : ''}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{fmtDate(c.created_on)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
        </main>
      </div>

      <CustomerModal customerId={openId} onClose={() => setOpenId(null)} onChanged={fetchData} />
      <NewCustomerModal isOpen={showNew} onClose={() => setShowNew(false)} onCreated={(c) => { fetchData(); setOpenId(c.id); }} />
    </div>
  );
};

export default PlatformCustomers;
