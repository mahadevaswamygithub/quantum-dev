import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import PageSpinner from '../components/common/PageSpinner';
import { useAuth } from '../context/AuthContext';
import { tenantAPI, userAPI } from '../services/api';
import { Building2, Users, TrendingUp, Plus, Activity, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AddOrganizationModal } from '../components/OrganizationModals';

const MSPDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [organizations, setOrganizations] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

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

  const stats = [
    { title: 'Organizations', value: organizations.length, sub: `${activeOrgs} active`, icon: Building2, color: 'from-blue-500 to-blue-600', bg: 'bg-blue-500/10' },
    { title: 'Total Users', value: users.length, sub: `${activeUsers} active`, icon: Users, color: 'from-green-500 to-emerald-600', bg: 'bg-green-500/10' },
    { title: 'Active Clients', value: activeOrgs, sub: `${organizations.length - activeOrgs} inactive`, icon: TrendingUp, color: 'from-purple-500 to-purple-600', bg: 'bg-purple-500/10' },
  ];

  if (loading) return <PageSpinner label="Loading..." />;

  return (
    <div className="min-h-screen bg-slate-900">
      <Navbar />
      <div className="flex">
        <Sidebar
          userRole={user.role}
          tenants={organizations}
          users={users}
          onAddTenant={() => setShowAddModal(true)}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(p => !p)}
        />

        <div className="flex-1 p-6 overflow-auto">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white">MSP Dashboard</h1>
            <p className="text-slate-400 text-sm mt-1">Welcome back, {user.first_name}!</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {stats.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={i} className="bg-slate-800 border border-slate-700 rounded-xl p-5 hover:border-slate-600 transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <div className={`w-10 h-10 ${s.bg} rounded-lg flex items-center justify-center`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-xs text-slate-500">{s.sub}</span>
                  </div>
                  <p className="text-2xl font-bold text-white">{s.value}</p>
                  <p className="text-sm text-slate-400 mt-0.5">{s.title}</p>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Recent Organizations */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
              <div className="p-5 border-b border-slate-700 flex items-center justify-between">
                <h2 className="font-semibold text-white">Recent Organizations</h2>
                <button onClick={() => navigate('/msp/organizations')} className="text-xs text-green-400 hover:text-green-300 flex items-center gap-1">
                  View All <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              <div className="p-4 space-y-2">
                {organizations.slice(0, 5).map(org => (
                  <div
                    key={org.id}
                    onClick={() => navigate(`/msp/organizations/${org.id}`)}
                    className="flex items-center justify-between p-3 hover:bg-slate-700/50 rounded-lg cursor-pointer transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-purple-500/20 text-purple-400 rounded-lg flex items-center justify-center">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium group-hover:text-green-400 transition-colors">{org.name}</p>
                        <p className="text-xs text-slate-500">{org.user_count || 0} users</p>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${org.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      {org.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                ))}
                {organizations.length === 0 && (
                  <div className="text-center py-8">
                    <Building2 className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                    <p className="text-slate-400 text-sm mb-3">No organizations yet</p>
                    <button onClick={() => setShowAddModal(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-all">
                      <Plus className="w-3.5 h-3.5" /> Add Organization
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Users */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
              <div className="p-5 border-b border-slate-700 flex items-center justify-between">
                <h2 className="font-semibold text-white">Recent Users</h2>
                <button onClick={() => navigate('/msp/users')} className="text-xs text-green-400 hover:text-green-300 flex items-center gap-1">
                  View All <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              <div className="p-4 space-y-2">
                {users.slice(0, 5).map(u => (
                  <div
                    key={u.id}
                    onClick={() => navigate(`/msp/users/${u.id}`)}
                    className="flex items-center gap-3 p-3 hover:bg-slate-700/50 rounded-lg cursor-pointer transition-all group"
                  >
                    <div className="w-8 h-8 bg-blue-500/20 text-blue-400 rounded-full flex items-center justify-center text-xs font-bold">
                      {u.first_name?.[0]}{u.last_name?.[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium group-hover:text-green-400 transition-colors truncate">{u.first_name} {u.last_name}</p>
                      <p className="text-xs text-slate-500 truncate">{u.organization_name || 'No org'}</p>
                    </div>
                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium flex-shrink-0 ${u.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <AddOrganizationModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={fetchData}
        parentOrgId={user.organization_id}
      />
    </div>
  );
};

export default MSPDashboard;