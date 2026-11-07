import React, { useState, useEffect, useCallback } from 'react';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import RefreshButton from '../components/common/RefreshButton';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import PageSpinner from '../components/common/PageSpinner';
import Pagination from '../components/common/Pagination';
import SearchFilterBar from '../components/common/SearchFilterBar';
import { useAuth } from '../context/AuthContext';
import { activityAPI } from '../services/api';
import {
  History, Plus, Pencil, Trash2, LogIn, LogOut, ChevronDown, ChevronUp,
} from 'lucide-react';

const PAGE_SIZE = 20;

const ACTION_META = {
  CREATE: { icon: Plus, label: 'Create', cls: 'bg-green-500/20 text-green-600 dark:text-green-400' },
  UPDATE: { icon: Pencil, label: 'Update', cls: 'bg-amber-500/20 text-amber-600 dark:text-amber-400' },
  DELETE: { icon: Trash2, label: 'Delete', cls: 'bg-red-500/20 text-red-600 dark:text-red-400' },
  LOGIN: { icon: LogIn, label: 'Login', cls: 'bg-blue-500/20 text-blue-600 dark:text-blue-400' },
  LOGOUT: { icon: LogOut, label: 'Logout', cls: 'bg-slate-500/20 text-slate-600 dark:text-slate-400' },
};

const ActionBadge = ({ action }) => {
  const meta = ACTION_META[action] || ACTION_META.UPDATE;
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${meta.cls}`}>
      <Icon className="w-3 h-3" /> {meta.label}
    </span>
  );
};

const ChangesCell = ({ changes }) => {
  const [open, setOpen] = useState(false);
  if (!changes || Object.keys(changes).length === 0) return <span className="text-slate-400 dark:text-slate-500 text-xs">-</span>;
  const entries = Object.entries(changes);
  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
      >
        {entries.length} field{entries.length !== 1 ? 's' : ''} {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {open && (
        <div className="mt-1.5 space-y-1">
          {entries.map(([field, [oldVal, newVal]]) => (
            <div key={field} className="text-xs text-slate-500 dark:text-slate-400">
              <span className="font-medium text-slate-600 dark:text-slate-300">{field}</span>:{' '}
              <span className="line-through opacity-70">{oldVal ?? '-'}</span>{' → '}
              <span className="text-slate-900 dark:text-white">{newVal ?? '-'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const ActivityLogPage = () => {
  const { user } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [modelFilter, setModelFilter] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (actionFilter !== 'ALL') params.action = actionFilter;
      if (modelFilter !== 'ALL') params.model_name = modelFilter;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const { data } = await activityAPI.list(params);
      setLogs(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search, actionFilter, modelFilter, dateFrom, dateTo]);
  const live = useAutoRefresh(fetchLogs, { onFocus: false });

  useEffect(() => {
    const t = setTimeout(fetchLogs, 300); // debounce the search box
    return () => clearTimeout(t);
  }, [fetchLogs]);

  // Any filter change reshuffles the result set - start back on page 1
  // so the user isn't left staring at an out-of-range/empty page.
  useEffect(() => { setPage(1); }, [search, actionFilter, modelFilter, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(logs.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageLogs = logs.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="h-screen overflow-hidden bg-slate-50 dark:bg-slate-900 flex flex-col">
      <Navbar />
      <div className="flex flex-1 min-h-0">
        <Sidebar
          userRole={user.role}
         
         
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(p => !p)}
        />

        <div className="flex-1 p-3 sm:p-6 overflow-hidden min-h-0 flex flex-col">
          {/* Static header + toolbar - only the records list below scrolls */}
          <div className="flex-shrink-0">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4 sm:mb-6">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <History className="w-6 h-6 text-green-500" /> Activity Log
                </h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
                  {user.role === 'MSP_ADMIN' ? 'Record changes and sign-ins across your organizations' : 'Record changes and sign-ins in your organization'}
                </p>
              </div>
              <RefreshButton onClick={live.refresh} refreshing={live.refreshing} lastUpdated={live.lastUpdated} />
            </div>

            {/* Toolbar */}
            <SearchFilterBar search={search} onSearchChange={setSearch} placeholder="Search by user or record...">
              <select
                value={actionFilter}
                onChange={e => setActionFilter(e.target.value)}
                className="px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="ALL">All Actions</option>
                <option value="CREATE">Create</option>
                <option value="UPDATE">Update</option>
                <option value="DELETE">Delete</option>
                <option value="LOGIN">Login</option>
                <option value="LOGOUT">Logout</option>
              </select>
              <select
                value={modelFilter}
                onChange={e => setModelFilter(e.target.value)}
                className="px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="ALL">All Records</option>
                <option value="Organization">Organization</option>
                <option value="User">User</option>
              </select>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <span className="text-slate-400 text-sm">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </SearchFilterBar>
          </div>

          {/* Scrollable records - header/toolbar above and pagination below stay put.
              overflow-auto lives directly on this card (not on a nested
              overflow-x-auto wrapper) so the sticky thead below has an actual
              scrolling ancestor to stick within - nesting it one level down
              silently breaks position:sticky. */}
          <div className="flex-1 overflow-auto min-h-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
            {loading ? (
              <PageSpinner label="Loading activity..." />
            ) : logs.length === 0 ? (
              <div className="p-12 text-center text-slate-500 dark:text-slate-400 text-sm">No activity found for these filters.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-white dark:bg-slate-800">
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-left text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    <th className="px-4 py-3 font-medium">Time</th>
                    <th className="px-4 py-3 font-medium">User</th>
                    <th className="px-4 py-3 font-medium">Action</th>
                    <th className="px-4 py-3 font-medium">Record</th>
                    <th className="px-4 py-3 font-medium">Organization</th>
                    <th className="px-4 py-3 font-medium">Changes</th>
                  </tr>
                </thead>
                <tbody>
                  {pageLogs.map(log => (
                    <tr key={log.id} className="border-b border-slate-100 dark:border-slate-700/50 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-slate-900 dark:text-white font-medium">{log.actor_username || 'System'}</div>
                        {log.actor_role && <div className="text-xs text-slate-400">{log.actor_role.replace('_', ' ')}</div>}
                      </td>
                      <td className="px-4 py-3"><ActionBadge action={log.action} /></td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                        {log.object_repr || <span className="text-slate-400">-</span>}
                        {log.model_name && <div className="text-xs text-slate-400">{log.model_name}</div>}
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{log.organization_name || '-'}</td>
                      <td className="px-4 py-3"><ChangesCell changes={log.changes} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {!loading && (
            <Pagination
              page={currentPage}
              totalPages={totalPages}
              onPageChange={setPage}
              rangeStart={(currentPage - 1) * PAGE_SIZE + 1}
              rangeEnd={Math.min(currentPage * PAGE_SIZE, logs.length)}
              totalCount={logs.length}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default ActivityLogPage;
