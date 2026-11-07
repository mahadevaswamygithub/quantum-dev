import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, ArrowRight, BedDouble, CalendarDays, CalendarRange, Clock, CreditCard, Hotel, IndianRupee, LogIn, LogOut,
  MessageSquareWarning, UserPlus, Users,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import PageSpinner from '../components/common/PageSpinner';
import RefreshButton from '../components/common/RefreshButton';
import WalkInModal from '../components/WalkInModal';
import { useAuth } from '../context/AuthContext';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { usePermissions } from '../hooks/usePermissions';
import { bookingAPI } from '../services/api';

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };
const card = 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl';

const Kpi = ({ icon: Icon, label, value, sub, tone, children }) => (
  <div className={`${card} p-5`}>
    <div className="flex items-center justify-between">
      <span className={`w-10 h-10 rounded-lg flex items-center justify-center ${tone}`}><Icon className="w-5 h-5" /></span>
      {sub && <span className="text-xs text-slate-500 dark:text-slate-400">{sub}</span>}
    </div>
    <p className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
    <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
    {children}
  </div>
);

/** 30-day bar chart (SVG, no chart library). */
const TrendChart = ({ series, metric }) => {
  const values = series.map(d => Number(d[metric]));
  const max = Math.max(1, ...values);
  const W = 600; const H = 160; const gap = 4;
  const bw = (W - gap * (series.length - 1)) / series.length;
  const total = values.reduce((a, b) => a + b, 0);
  return (
    <div>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
        Last 30 days: <b className="text-slate-900 dark:text-white">{metric === 'revenue' ? money(total) : `${total} booking${total === 1 ? '' : 's'}`}</b>
      </p>
      <svg viewBox={`0 0 ${W} ${H + 18}`} className="w-full h-48" role="img" aria-label={`${metric} per day, last 30 days`}>
        {[0.25, 0.5, 0.75, 1].map(f => <line key={f} x1="0" x2={W} y1={H - H * f} y2={H - H * f} className="stroke-slate-200 dark:stroke-slate-700" strokeWidth="1" />)}
        {series.map((d, i) => {
          const v = Number(d[metric]);
          const h = v ? Math.max(3, (v / max) * (H - 6)) : 0;
          const x = i * (bw + gap);
          return (
            <g key={d.date}>
              <rect x={x} y={H - h} width={bw} height={h} rx="3" className={metric === 'revenue' ? 'fill-green-500' : 'fill-blue-500'}>
                <title>{`${new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}: ${metric === 'revenue' ? money(v) : `${v} booking${v === 1 ? '' : 's'}`}`}</title>
              </rect>
              {i % 5 === 0 && <text x={x + bw / 2} y={H + 14} textAnchor="middle" className="fill-slate-400 text-[10px]">{new Date(d.date).getDate()}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
};

const GuestList = ({ title, icon: Icon, rows, empty, action, onAction, busyId, navigate }) => (
  <div className={`${card} overflow-hidden`}>
    <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
      <Icon className="w-5 h-5 text-slate-400" />
      <h3 className="font-semibold text-slate-900 dark:text-white">{title}</h3>
      <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">{rows.length}</span>
    </div>
    {rows.length === 0 ? <p className="px-5 py-8 text-sm text-center text-slate-500 dark:text-slate-400">{empty}</p> : (
      <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
        {rows.map(b => (
          <li key={b.id} className="px-5 py-3 flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold flex items-center justify-center flex-shrink-0">{b.room}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{b.guest} <span className="text-xs text-slate-400">· {b.guests} guest{b.guests > 1 ? 's' : ''}</span></p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {b.phone || 'No phone'}{Number(b.balance_due) > 0 && <span className="text-amber-600 dark:text-amber-400"> · {money(b.balance_due)} due</span>}
                {b.status === 'PENDING' && <span className="text-amber-600 dark:text-amber-400"> · awaiting confirmation</span>}
              </p>
            </div>
            {action && onAction && action.when(b) && (
              <button type="button" disabled={busyId === b.id} onClick={() => onAction(b)}
                className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-semibold disabled:opacity-50">{action.label}</button>
            )}
          </li>
        ))}
      </ul>
    )}
    <button type="button" onClick={() => navigate('/stp/bookings')} className="w-full px-5 py-2.5 text-xs font-semibold text-green-600 dark:text-green-400 border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/40">
      All bookings →
    </button>
  </div>
);

/** Hotel front-office dashboard: today's arrivals/departures, occupancy, money and what needs attention. */
const STPDashboard = () => {
  const { can } = usePermissions();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [metric, setMetric] = useState('bookings');
  const [walkIn, setWalkIn] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const canBookings = can('bookings.view');
  const canMoney = can('payments.report');

  const fetchData = useCallback(async () => {
    if (!canBookings) { setData({}); return; }
    try { setData((await bookingAPI.getDashboard()).data); setError(''); }
    catch (err) { setError(err.response?.data?.error || 'Could not load the dashboard.'); setData(d => d || {}); }
  }, [canBookings]);
  useEffect(() => { fetchData(); }, [fetchData]);
  const live = useAutoRefresh(fetchData, { interval: 60000 });
  useEffect(() => { if (canMoney) setMetric('revenue'); }, [canMoney]);

  const run = async (b, fn) => {
    setBusyId(b.id);
    try { await fn(b.id); await fetchData(); } catch (err) { alert(err.response?.data?.error || 'Action failed'); } finally { setBusyId(null); }
  };

  const attention = useMemo(() => (data?.series ? [
    { show: data.cancel_requests > 0, icon: MessageSquareWarning, text: `${data.cancel_requests} cancellation request${data.cancel_requests > 1 ? 's' : ''} to review`, tone: 'red' },
    { show: data.pending_confirmations > 0, icon: Clock, text: `${data.pending_confirmations} booking request${data.pending_confirmations > 1 ? 's' : ''} waiting for confirmation`, tone: 'amber' },
    { show: canMoney && data.payments_due?.count > 0, icon: CreditCard, text: `${money(data.payments_due.amount)} still to collect on ${data.payments_due.count} booking${data.payments_due.count > 1 ? 's' : ''}`, tone: 'amber' },
  ].filter(a => a.show) : []), [data, canMoney]);

  if (!data) return <PageSpinner />;

  return (
    <div className="h-screen overflow-hidden bg-slate-50 dark:bg-slate-900 flex flex-col">
      <Navbar />
      <div className="flex flex-1 min-h-0">
        <Sidebar userRole={user.role} collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(p => !p)} />
        <div className="flex-1 p-3 sm:p-6 overflow-y-auto min-h-0">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{greeting()}, {user.first_name}</h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                {user.organization_name} · {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {can('bookings.manage') && (
                <button type="button" onClick={() => setWalkIn(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold">
                  <UserPlus className="w-4 h-4" /> Walk-in booking
                </button>
              )}
              {canBookings && (
                <button type="button" onClick={() => navigate('/stp/calendar')} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">
                  <CalendarRange className="w-4 h-4" /> Room calendar
                </button>
              )}
              <RefreshButton onClick={live.refresh} refreshing={live.refreshing} lastUpdated={live.lastUpdated} />
            </div>
          </div>

          {!canBookings ? (
            <div className={`${card} p-8 text-center text-slate-500 dark:text-slate-400`}>
              <Hotel className="w-10 h-10 mx-auto mb-2 text-slate-300" />Your role doesn’t include bookings. Use the menu on the left for the areas you can access.
            </div>
          ) : (
            <>
              {error && <p className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-500/10 text-sm text-red-700 dark:text-red-300">{error}</p>}

              {attention.length > 0 && (
                <div className="mb-6 grid gap-3 md:grid-cols-3">
                  {attention.map(({ icon: Icon, text, tone }) => (
                    <button key={text} type="button" onClick={() => navigate(tone === 'amber' && Icon === CreditCard ? '/stp/collections' : '/stp/bookings')}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left text-sm font-medium transition-colors ${
                        tone === 'red' ? 'bg-red-50 border-red-200 text-red-800 hover:border-red-300 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-200'
                          : 'bg-amber-50 border-amber-200 text-amber-900 hover:border-amber-300 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-200'}`}>
                      <Icon className="w-5 h-5 flex-shrink-0" /><span className="flex-1">{text}</span><ArrowRight className="w-4 h-4" />
                    </button>
                  ))}
                </div>
              )}

              <div className="grid gap-4 grid-cols-2 xl:grid-cols-6 mb-6">
                <Kpi icon={BedDouble} label="Occupancy tonight" value={`${data.occupancy}%`} sub={`${data.occupied_tonight}/${data.rooms_total} rooms`} tone="bg-green-500/10 text-green-600 dark:text-green-400">
                  <div className="mt-3 h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden"><div className="h-full bg-green-500 rounded-full" style={{ width: `${data.occupancy}%` }} /></div>
                </Kpi>
                <Kpi icon={LogIn} label="Arrivals today" value={data.arrivals.length} tone="bg-blue-500/10 text-blue-600 dark:text-blue-400" />
                <Kpi icon={LogOut} label="Departures today" value={data.departures.length} tone="bg-violet-500/10 text-violet-600 dark:text-violet-400" />
                <Kpi icon={Users} label="Guests in house" value={data.in_house} sub={`${data.upcoming_7_days} arriving in 7 days`} tone="bg-sky-500/10 text-sky-600 dark:text-sky-400" />
                {canMoney ? (
                  <>
                    <Kpi icon={IndianRupee} label="Collected today" value={money(data.revenue_today)} tone="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" />
                    <Kpi icon={CalendarDays} label="Collected this month" value={money(data.revenue_month)} tone="bg-teal-500/10 text-teal-600 dark:text-teal-400" />
                  </>
                ) : (
                  <Kpi icon={AlertTriangle} label="Need attention" value={data.cancel_requests + data.pending_confirmations} tone="bg-amber-500/10 text-amber-600 dark:text-amber-400" />
                )}
              </div>

              <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr_1fr] mb-6">
                <div className={`${card} p-5`}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-slate-900 dark:text-white">Trend</h3>
                    <div className="inline-flex p-1 rounded-lg bg-slate-100 dark:bg-slate-700/60 text-xs font-semibold">
                      {['bookings', ...(canMoney ? ['revenue'] : [])].map(m => (
                        <button key={m} type="button" onClick={() => setMetric(m)}
                          className={`px-3 py-1 rounded-md capitalize ${metric === m ? 'bg-white dark:bg-slate-800 shadow text-slate-900 dark:text-white' : 'text-slate-500'}`}>{m}</button>
                      ))}
                    </div>
                  </div>
                  <TrendChart series={data.series} metric={metric} />
                </div>
                <GuestList title="Arriving today" icon={LogIn} rows={data.arrivals} empty="No arrivals today." navigate={navigate} busyId={busyId}
                  action={can('bookings.manage') ? { label: 'Check in', when: b => b.status === 'CONFIRMED' } : null}
                  onAction={b => run(b, bookingAPI.checkInBooking)} />
                <GuestList title="Leaving today" icon={LogOut} rows={data.departures} empty="No departures today." navigate={navigate} busyId={busyId}
                  action={can('bookings.manage') ? { label: 'Check out', when: b => b.status === 'CHECKED_IN' } : null}
                  onAction={b => run(b, bookingAPI.checkOutBooking)} />
              </div>
            </>
          )}
        </div>
      </div>
      <WalkInModal open={walkIn} onClose={() => setWalkIn(false)} onSaved={fetchData} />
    </div>
  );
};

export default STPDashboard;
