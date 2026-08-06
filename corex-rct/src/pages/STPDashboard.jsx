import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import PageSpinner from '../components/common/PageSpinner';
import { useAuth } from '../context/AuthContext';
import { userAPI } from '../services/api';
import { Users, Activity, Settings, ArrowRight, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const STPDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await userAPI.getUsers();
        setUsers(res.data || []);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    })();
  }, []);

  const active = users.filter(u => u.is_active).length;
  const admins = users.filter(u => u.role?.includes('ADMIN')).length;

  if (loading) return <PageSpinner />;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Navbar />
      <div className="flex">
        <Sidebar userRole={user.role} users={users} collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(p => !p)} />

        <div className="flex-1 p-6 overflow-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">STP Dashboard</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Welcome to {user.organization_name || 'your organization'}</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {[
              { title: 'Total Users', value: users.length, sub: `${active} active`, icon: Users, bg: 'bg-blue-500/10', color: 'text-blue-400' },
              { title: 'Active Users', value: active, sub: `${users.length - active} inactive`, icon: Activity, bg: 'bg-green-500/10', color: 'text-green-400' },
              { title: 'Administrators', value: admins, sub: `${users.length - admins} regular`, icon: Settings, bg: 'bg-purple-500/10', color: 'text-purple-400' },
            ].map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={i} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 hover:border-slate-300 dark:hover:border-slate-600 transition-all">
                  <div className={`w-10 h-10 ${s.bg} rounded-lg flex items-center justify-center mb-3`}>
                    <Icon className={`w-5 h-5 ${s.color}`} />
                  </div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{s.value}</p>
                  <p className="text-sm text-slate-900 dark:text-white">{s.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-500 mt-0.5">{s.sub}</p>
                </div>
              );
            })}
          </div>

          {/* Quick Actions */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 mb-5">
            <h2 className="font-semibold text-slate-900 dark:text-white mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { icon: UserPlus, label: 'Add User', sub: 'Create a new user account', color: 'text-blue-400', bg: 'bg-blue-500/10', action: () => navigate('/stp/users') },
                { icon: Users, label: 'Manage Users', sub: 'View and manage all users', color: 'text-green-400', bg: 'bg-green-500/10', action: () => navigate('/stp/users') },
                { icon: Settings, label: 'Settings', sub: 'Configure organization settings', color: 'text-purple-400', bg: 'bg-purple-500/10', action: () => navigate('/stp/settings') },
              ].map((a, i) => {
                const Icon = a.icon;
                return (
                  <button key={i} onClick={a.action} className="p-4 bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-left transition-all group border border-transparent hover:border-slate-300 dark:hover:border-slate-600">
                    <div className={`w-9 h-9 ${a.bg} rounded-lg flex items-center justify-center mb-3`}>
                      <Icon className={`w-4 h-4 ${a.color}`} />
                    </div>
                    <p className="text-slate-900 dark:text-white font-medium text-sm">{a.label}</p>
                    <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">{a.sub}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Recent Users Table */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900 dark:text-white">Recent Users</h2>
              <button onClick={() => navigate('/stp/users')} className="text-xs text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 flex items-center gap-1">
                View All <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-700/50">
                  <tr>
                    {['User', 'Email', 'Role', 'Status'].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {users.slice(0, 8).map(u => (
                    <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors cursor-pointer" onClick={() => navigate(`/stp/users/${u.id}`)}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-xs font-bold">
                            {u.first_name?.[0]}{u.last_name?.[0]}
                          </div>
                          <span className="text-slate-900 dark:text-white text-sm font-medium hover:text-green-600 dark:hover:text-green-400 transition-colors">{u.first_name} {u.last_name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-slate-500 dark:text-slate-400 text-sm">{u.email}</td>
                      <td className="px-5 py-3">
                        <span className="px-2 py-0.5 text-xs rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400 font-medium">{u.role}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${u.is_active ? 'bg-green-500/20 text-green-600 dark:text-green-400' : 'bg-red-500/20 text-red-600 dark:text-red-400'}`}>
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default STPDashboard;