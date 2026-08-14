import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import PageSpinner from '../components/common/PageSpinner';
import { useAuth } from '../context/AuthContext';
import { tenantAPI, userAPI } from '../services/api';
import { Building2, Users, TrendingUp } from 'lucide-react';
import WorldMap from '../components/WorldMap';
import { ORG_TYPES } from '../constants/orgTypes';

const MSPDashboard = () => {
  const { user } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [organizations, setOrganizations] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [orgsRes, usersRes] = await Promise.all([
        tenantAPI.getTenants(),
        userAPI.getUsers(),
      ]);
      setOrganizations(orgsRes.data || []);
      setUsers(usersRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const activeOrgs = organizations.filter(o => o.is_active).length;
  const activeUsers = users.filter(u => u.is_active).length;

  // Sub-orgs only ever carry a business-vertical org_type (MSP's own org
  // never does — see constants/orgTypes.js), so this only needs to cover
  // what `organizations` (tenantAPI.getTenants(), sub-orgs only) already is.
  const orgTypeCounts = ORG_TYPES.map(t => ({
    ...t,
    count: organizations.filter(o => o.org_type === t.value).length,
  }));

  const stats = [
    { title: 'Organizations', value: organizations.length, sub: `${activeOrgs} active`, icon: Building2, color: 'from-blue-500 to-blue-600', bg: 'bg-blue-500/10' },
    { title: 'Total Users', value: users.length, sub: `${activeUsers} active`, icon: Users, color: 'from-green-500 to-emerald-600', bg: 'bg-green-500/10' },
    { title: 'Active Clients', value: activeOrgs, sub: `${organizations.length - activeOrgs} inactive`, icon: TrendingUp, color: 'from-purple-500 to-purple-600', bg: 'bg-purple-500/10' },
  ];

  if (loading) return <PageSpinner label="Loading..." />;

  return (
    <div className="h-screen overflow-hidden bg-slate-50 dark:bg-slate-900 flex flex-col">
      <Navbar />
      <div className="flex flex-1 min-h-0">
        <Sidebar
          userRole={user.role}
          tenants={organizations}
          users={users}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(p => !p)}
        />

        <div className="flex-1 p-6 overflow-y-auto min-h-0">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">MSP Dashboard</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Welcome back, {user.first_name}!</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {stats.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={i} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 hover:border-slate-300 dark:hover:border-slate-600 transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <div className={`w-10 h-10 ${s.bg} rounded-lg flex items-center justify-center`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-500">{s.sub}</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{s.value}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{s.title}</p>
                </div>
              );
            })}
          </div>

          {/* World map */}
          <div className="mb-6">
            <WorldMap organizations={organizations} />
          </div>

          {/* Organizations by Type — what business verticals you're
              currently managing, instead of a "recent" list that just
              duplicates the Organizations page one click away. */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
            <h2 className="font-semibold text-slate-900 dark:text-white mb-4">Organizations by Type</h2>
            {organizations.length === 0 ? (
              <div className="text-center py-8">
                <Building2 className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-slate-500 dark:text-slate-400 text-sm">No organizations yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {orgTypeCounts.map(t => (
                  <div key={t.value} className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{t.count}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t.label}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MSPDashboard;