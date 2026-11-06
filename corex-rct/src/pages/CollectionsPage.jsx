import React, { useCallback, useEffect, useState } from 'react';
import { Banknote, ChevronLeft, ChevronRight, CreditCard, Download, Globe, Loader2, Smartphone, Wallet } from 'lucide-react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import Card from '../components/common/Card';
import EmptyState from '../components/common/EmptyState';
import RefreshButton from '../components/common/RefreshButton';
import { useAuth } from '../context/AuthContext';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { bookingAPI } from '../services/api';
import { addDaysISO, formatDate, formatMoney, todayISO } from '../components/guest/guestUtils';

const METHOD_META = {
  ONLINE: { label: 'Online', icon: Globe, cls: 'text-blue-600 bg-blue-500/10' },
  CASH: { label: 'Cash', icon: Banknote, cls: 'text-green-600 bg-green-500/10' },
  UPI: { label: 'UPI', icon: Smartphone, cls: 'text-purple-600 bg-purple-500/10' },
  CARD: { label: 'Card', icon: CreditCard, cls: 'text-amber-600 bg-amber-500/10' },
  OTHER: { label: 'Other', icon: Wallet, cls: 'text-slate-600 bg-slate-500/10' },
};

const toCsv = (report) => {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = ['Time', 'Booking', 'Guest', 'Room', 'Method', 'Amount', 'Collected by', 'Note', 'Refunded'];
  const rows = report.payments.map(p => [p.time, p.booking_id, p.guest, p.room, p.method_label, p.amount, p.collected_by || '', p.note, p.refunded ? 'yes' : '']);
  const totals = [[], ['Totals'], ...Object.entries(report.totals).map(([m, v]) => [METHOD_META[m]?.label || m, v]),
    ['Gross', report.gross], ['Refunds', report.refunds], ['Net', report.net]];
  return [head, ...rows, ...totals].map(r => r.map(esc).join(',')).join('\n');
};

/** Daily collection: what was received today (or any day), by payment method and by whom. */
const CollectionsPage = () => {
  const { user } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [day, setDay] = useState(todayISO());
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const { data } = await bookingAPI.getCollections(day);
      setReport(data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load collections.');
    }
  }, [day]);

  useEffect(() => { setReport(null); load(); }, [load]);
  const live = useAutoRefresh(load, { interval: day === todayISO() ? 60000 : 0 });

  const exportCsv = () => {
    const blob = new Blob([toCsv(report)], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `collection-${report.date}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="h-screen overflow-hidden bg-slate-50 dark:bg-slate-900 flex flex-col">
      <Navbar />
      <div className="flex flex-1 min-h-0">
        <Sidebar userRole={user.role} collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(p => !p)} />
        <main className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Daily collection</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">Money received on {formatDate(day, { withYear: true })}, by payment method.</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800">
                <button type="button" aria-label="Previous day" onClick={() => setDay(d => addDaysISO(d, -1))} className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white"><ChevronLeft className="w-4 h-4" /></button>
                <input type="date" value={day} max={todayISO()} onChange={e => e.target.value && setDay(e.target.value)}
                  className="bg-transparent text-sm text-slate-900 dark:text-white px-1 py-1.5 focus:outline-none [color-scheme:light] dark:[color-scheme:dark]" aria-label="Day" />
                <button type="button" aria-label="Next day" disabled={day >= todayISO()} onClick={() => setDay(d => addDaysISO(d, 1))} className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
              </div>
              {day !== todayISO() && <button type="button" onClick={() => setDay(todayISO())} className="px-3 py-2 text-sm font-medium text-green-600 hover:text-green-700">Today</button>}
              <button type="button" onClick={exportCsv} disabled={!report?.count}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-white disabled:opacity-50">
                <Download className="w-4 h-4" /> Export
              </button>
              <RefreshButton onClick={live.refresh} refreshing={live.refreshing} lastUpdated={live.lastUpdated} />
            </div>
          </div>

          {error && <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-600 dark:text-red-400">{error}</div>}

          {!report ? (
            <div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
          ) : (
            <>
              <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6 mb-6">
                <Card className="p-4 col-span-2 md:col-span-3 xl:col-span-1 bg-gradient-to-br from-green-500 to-emerald-600 border-0">
                  <p className="text-sm text-white/85">Net collected</p>
                  <p className="mt-1 text-2xl font-bold text-white tabular-nums">{formatMoney(report.net)}</p>
                  <p className="text-xs text-white/80">{report.count} payment{report.count === 1 ? '' : 's'}{Number(report.refunds) ? ` · refunds ${formatMoney(report.refunds)}` : ''}</p>
                </Card>
                {Object.entries(METHOD_META).map(([m, meta]) => {
                  const Icon = meta.icon;
                  return (
                    <Card key={m} className="p-4">
                      <div className="flex items-center gap-2">
                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${meta.cls}`}><Icon className="w-4 h-4" /></span>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{meta.label}</p>
                      </div>
                      <p className="mt-2 text-xl font-semibold text-slate-900 dark:text-white tabular-nums">{formatMoney(report.totals[m])}</p>
                    </Card>
                  );
                })}
              </div>

              <Card className="overflow-hidden">
                {report.payments.length === 0 ? (
                  <EmptyState icon={Wallet} title="No payments on this day" description="Payments recorded at the desk and online payments appear here." />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 dark:bg-slate-800/60 text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        <tr>
                          {['Time', 'Guest', 'Room', 'Method', 'Collected by', 'Note', 'Amount'].map(h => (
                            <th key={h} className={`px-4 py-3 font-semibold ${h === 'Amount' ? 'text-right' : ''}`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {report.payments.map(p => {
                          const meta = METHOD_META[p.method] || METHOD_META.OTHER;
                          return (
                            <tr key={p.id} className={p.refunded ? 'opacity-60' : ''}>
                              <td className="px-4 py-3 tabular-nums text-slate-600 dark:text-slate-300">{p.time}</td>
                              <td className="px-4 py-3 text-slate-900 dark:text-white">{p.guest}<span className="text-slate-400"> · #{p.booking_id}</span></td>
                              <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{p.room}</td>
                              <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${meta.cls}`}>{meta.label}</span></td>
                              <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{p.collected_by || <span className="text-slate-400">Online</span>}</td>
                              <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{p.note}</td>
                              <td className="px-4 py-3 text-right font-medium tabular-nums text-slate-900 dark:text-white">
                                {formatMoney(p.amount)}{p.refunded && <span className="ml-1 text-xs text-red-500">refunded</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default CollectionsPage;
