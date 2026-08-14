import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import PageSpinner from '../components/common/PageSpinner';
import { useAuth } from '../context/AuthContext';
import { activityAPI, tenantAPI, userAPI } from '../services/api';
import {
  History, Search, Plus, Pencil, Trash2, LogIn, LogOut, ChevronDown, ChevronUp,
} from 'lucide-react';

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
  if (!changes || Object.keys(changes).length === 0) return <span className="text-slate-400 dark:text-slate-500 text-xs">—</span>;
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
              <span className="line-through opacity-70">{oldVal ?? '—'}</span>{' → '}
              <span className="text-slate-900 dark:text-white">{newVal ?? '—'}</span>
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
  const [tenants, setTenants] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [modelFilter, setModelFilter] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

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

  // Sidebar just needs counts for its badges — fetched once, independent of the log filters/table above.
  useEffect(() => {
    const isMSP = user.role === 'MSP_ADMIN' || user.role === 'MSP_USER';
    (async () => {
      try {
        const calls = [userAPI.getUsers()];
        if (isMSP) calls.push(tenantAPI.getTenants());
        const [usersRes, tenantsRes] = await Promise.all(calls);
        setAllUsers(usersRes.data || []);
        if (tenantsRes) setTenants(tenantsRes.data || []);
      } catch (err) { console.error(err); }
    })();
  }, [user.role]);

  useEffect(() => {
    const t = setTimeout(fetchLogs, 300); // debounce the search box
    return () => clearTimeout(t);
  }, [fetchLogs]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Navbar />
      <div className="flex">
        <Sidebar
          userRole={user.role}
          tenants={tenants}
          users={allUsers}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(p => !p)}
        />

        <div className="flex-1 p-6 overflow-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <History className="w-6 h-6 text-green-500" /> Activity Log
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
                {user.role === 'MSP_ADMIN' ? 'Record changes and sign-ins across your organizations' : 'Record changes and sign-ins in your organization'}
              </p>
            </div>
          </div>

          {/* Toolbar */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 mb-5 flex flex-wrap gap-3 items-center">
            <div className="flex-1 min-w-48 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by user or record..."
                className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
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
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            {loading ? (
              <PageSpinner label="Loading activity..." />
            ) : logs.length === 0 ? (
              <div className="p-12 text-center text-slate-500 dark:text-slate-400 text-sm">No activity found for these filters.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
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
                    {logs.map(log => (
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
                          {log.object_repr || <span className="text-slate-400">—</span>}
                          {log.model_name && <div className="text-xs text-slate-400">{log.model_name}</div>}
                        </td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{log.organization_name || '—'}</td>
                        <td className="px-4 py-3"><ChangesCell changes={log.changes} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActivityLogPage;
