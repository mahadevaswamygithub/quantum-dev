import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, BedDouble, Building2, CalendarCheck, IndianRupee, Percent } from 'lucide-react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import PageSpinner from '../components/common/PageSpinner';
import RefreshButton from '../components/common/RefreshButton';
import Avatar from '../components/common/Avatar';
import WorldMap from '../components/WorldMap';
import { useAuth } from '../context/AuthContext';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { usePermissions } from '../hooks/usePermissions';
import { tenantAPI } from '../services/api';

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const HEALTH = {
  good: { label: 'Healthy', cls: 'bg-green-500/15 text-green-700 dark:text-green-400' },
  attention: { label: 'Needs attention', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' },
  quiet: { label: 'No bookings in 30 days', cls: 'bg-slate-500/15 text-slate-600 dark:text-slate-300' },
  setup: { label: 'Setup incomplete', cls: 'bg-blue-500/15 text-blue-700 dark:text-blue-400' },
  inactive: { label: 'Inactive', cls: 'bg-red-500/15 text-red-700 dark:text-red-400' },
};
const ago = (iso) => {
  if (!iso) return 'Never';
  const d = Math.floor((Date.now() - new Date(iso)) / 86400000);
  return d === 0 ? 'Today' : d === 1 ? 'Yesterday' : `${d} days ago`;
};

/** MSP overview: how every managed organization is doing, plus the location map. */
const MSPDashboard = () => {
  const { user } = useAuth();
  const { can } = usePermissions();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [overview, setOverview] = useState(null);
  const [orgs, setOrgs] = useState([]);
  const allowed = can('organizations.view');

  const fetchData = useCallback(async () => {
    if (!allowed) { setOverview({ totals: {}, organizations: [] }); return; }
    try {
      const [ov, list] = await Promise.all([tenantAPI.getOverview(), tenantAPI.getTenants()]);
      setOverview(ov.data);
      setOrgs(list.data || []);
    } catch { setOverview(o => o || { totals: {}, organizations: [] }); }
  }, [allowed]);
  useEffect(() => { fetchData(); }, [fetchData]);
  const live = useAutoRefresh(fetchData, { interval: 60000 });

  if (!overview) return <PageSpinner label="Loading..." />;
  const t = overview.totals || {};
  const tiles = [
    { label: 'Organizations', value: t.organizations ?? 0, sub: `${t.active ?? 0} active`, icon: Building2, tone: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
    { label: 'Rooms managed', value: t.rooms ?? 0, sub: `${t.occupied_tonight ?? 0} occupied tonight`, icon: BedDouble, tone: 'bg-sky-500/10 text-sky-600 dark:text-sky-400' },
    { label: 'Occupancy tonight', value: `${t.occupancy ?? 0}%`, icon: Percent, tone: 'bg-green-500/10 text-green-600 dark:text-green-400' },
    { label: 'Bookings this month', value: t.bookings_month ?? 0, icon: CalendarCheck, tone: 'bg-violet-500/10 text-violet-600 dark:text-violet-400' },
    { label: 'Collected this month', value: money(t.revenue_month), icon: IndianRupee, tone: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
    { label: 'Need attention', value: t.needs_attention ?? 0, icon: AlertTriangle, tone: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  ];

  return (
    <div className="h-screen overflow-hidden bg-slate-50 dark:bg-slate-900 flex flex-col">
      <Navbar />
      <div className="flex flex-1 min-h-0">
        <Sidebar userRole={user.role} collapsed={collapsed} onToggleCollapse={() => setCollapsed(c => !c)} />
        <div className="flex-1 p-3 sm:p-6 overflow-y-auto min-h-0">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">MSP Dashboard</h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Welcome back, {user.first_name} - here’s how your organizations are doing.</p>
            </div>
            <RefreshButton onClick={live.refresh} refreshing={live.refreshing} lastUpdated={live.lastUpdated} />
          </div>

          {!allowed ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 text-center text-slate-500 dark:text-slate-400">
              Your role doesn’t include organizations. Use the menu on the left for the areas you can access.
            </div>
          ) : (
            <>
              <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 mb-6">
                {tiles.map(({ label, value, sub, icon: Icon, tone }) => (
                  <div key={label} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
                    <div className="flex items-center justify-between">
                      <span className={`w-10 h-10 rounded-lg flex items-center justify-center ${tone}`}><Icon className="w-5 h-5" /></span>
                      {sub && <span className="text-xs text-slate-500 dark:text-slate-400">{sub}</span>}
                    </div>
                    <p className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
                  </div>
                ))}
              </div>

              <div className="mb-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold text-slate-900 dark:text-white">Organization health</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Sorted by money collected this month</p>
                  </div>
                  <button type="button" onClick={() => navigate('/msp/organizations')} className="text-sm font-semibold text-green-600 dark:text-green-400 hover:underline">All organizations →</button>
                </div>
                {overview.organizations.length === 0 ? (
                  <p className="px-5 py-10 text-center text-sm text-slate-500 dark:text-slate-400">No organizations yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                          <th className="px-5 py-3 font-medium">Organization</th>
                          <th className="px-4 py-3 font-medium">Health</th>
                          <th className="px-4 py-3 font-medium">Rooms</th>
                          <th className="px-4 py-3 font-medium min-w-[9rem]">Occupancy tonight</th>
                          <th className="px-4 py-3 font-medium">Bookings (month)</th>
                          <th className="px-4 py-3 font-medium">Collected (month)</th>
                          <th className="px-4 py-3 font-medium">Open requests</th>
                          <th className="px-4 py-3 font-medium">Last booking</th>
                          <th className="px-4 py-3 font-medium">Users</th>
                        </tr>
                      </thead>
                      <tbody>
                        {overview.organizations.map(o => {
                          const h = HEALTH[o.health] || HEALTH.good;
                          const open = o.pending + o.cancel_requests;
                          return (
                            <tr key={o.id} onClick={() => navigate(`/msp/organizations/${o.id}`)}
                              className="border-b border-slate-100 dark:border-slate-700/50 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer">
                              <td className="px-5 py-3">
                                <div className="flex items-center gap-3">
                                  <Avatar src={o.logo} icon={Building2} className="w-8 h-8 rounded-lg" bg="bg-purple-500/15" textClass="text-purple-500" />
                                  <span className="font-medium text-slate-900 dark:text-white">{o.name}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${h.cls}`}>{h.label}</span></td>
                              <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{o.rooms}</td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden"><div className="h-full bg-green-500" style={{ width: `${o.occupancy}%` }} /></div>
                                  <span className="w-10 text-right text-xs text-slate-600 dark:text-slate-300">{o.occupancy}%</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{o.bookings_month}</td>
                              <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{money(o.revenue_month)}</td>
                              <td className="px-4 py-3">{open ? <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 text-xs font-semibold">{open}</span> : <span className="text-slate-400">-</span>}</td>
                              <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">{ago(o.last_booking)}</td>
                              <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{o.users}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <WorldMap organizations={orgs} />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MSPDashboard;
