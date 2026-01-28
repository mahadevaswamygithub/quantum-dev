import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import { greenAdminAPI } from '../services/api';
import { Users, Building2, Shield, Activity, TrendingUp, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const GreenAdminDashboard = () => {
  const navigate = useNavigate();
  
  const [users, setUsers] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [stats, setStats] = useState({
    total_tenants: 0,
    msp_count: 0,
    stp_count: 0,
    total_users: 0,
    active_users: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [tenantsResponse, usersResponse, statsResponse] = await Promise.all([
        greenAdminAPI.getTenants(),
        greenAdminAPI.getUsers(),
        greenAdminAPI.getStats(),
      ]);
      
      setTenants(tenantsResponse.data || []);
      setUsers(usersResponse.data || []);
      setStats(statsResponse.data || {
        total_tenants: 0,
        msp_count: 0,
        stp_count: 0,
        total_users: 0,
        active_users: 0,
      });
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const displayStats = [
    {
      title: 'Total Organizations',
      value: stats.total_tenants || tenants.length,
      change: `${stats.msp_count} MSP, ${stats.stp_count} STP`,
      icon: Building2,
      color: 'from-blue-500 to-blue-600',
    },
    {
      title: 'MSP Organizations',
      value: stats.msp_count || tenants.filter((t) => t.tenant_type === 'MSP').length,
      change: 'Multi-Service Providers',
      icon: Shield,
      color: 'from-green-500 to-green-600',
    },
    {
      title: 'STP Organizations',
      value: stats.stp_count || tenants.filter((t) => t.tenant_type === 'STP').length,
      change: 'Single Tenant Portals',
      icon: Building2,
      color: 'from-purple-500 to-purple-600',
    },
    {
      title: 'Total Users',
      value: stats.total_users || users.length,
      change: `${stats.active_users || users.filter(u => u.is_active).length} active`,
      icon: Users,
      color: 'from-orange-500 to-orange-600',
    },
  ];

  const recentTenants = tenants.slice(0, 5);
  const recentUsers = users.slice(0, 5);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <p className="text-slate-400">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      <Navbar />
      
      <div className="flex">
        <Sidebar 
          userRole="GREEN_ADMIN" 
          tenants={tenants}
          users={users}
        />
        
        <div className="flex-1 p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Green Admin Dashboard</h1>
            <p className="text-slate-400">System-wide overview and management</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {displayStats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <div
                  key={index}
                  className="bg-slate-800 border border-slate-700 rounded-xl p-6 hover:border-green-500/50 transition-all"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-12 h-12 bg-gradient-to-br ${stat.color} rounded-lg flex items-center justify-center`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-white mb-1">{stat.value}</p>
                  <p className="text-sm text-slate-400 mb-1">{stat.title}</p>
                  <p className="text-xs text-slate-500">{stat.change}</p>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Organizations */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
              <div className="p-6 border-b border-slate-700 flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Recent Organizations</h2>
                <button
                  onClick={() => navigate('/green-admin/tenants')}
                  className="text-sm text-green-400 hover:text-green-300 font-medium flex items-center gap-1"
                >
                  View All
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
              <div className="p-6">
                {recentTenants.map((tenant) => (
                  <div
                    key={tenant.id}
                    onClick={() => navigate(`/green-admin/tenants/${tenant.id}`)}
                    className="flex items-center justify-between p-4 hover:bg-slate-700/50 rounded-lg mb-2 cursor-pointer transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        tenant.tenant_type === 'MSP'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-purple-500/20 text-purple-400'
                      }`}>
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-white font-medium group-hover:text-green-400 transition-colors">
                          {tenant.name}
                        </p>
                        <p className="text-xs text-slate-400">
                          {tenant.user_count || 0} users • {tenant.tenant_type}
                        </p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                      tenant.is_active
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {tenant.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Users */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
              <div className="p-6 border-b border-slate-700 flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Recent Users</h2>
                <button
                  onClick={() => navigate('/green-admin/users')}
                  className="text-sm text-green-400 hover:text-green-300 font-medium flex items-center gap-1"
                >
                  View All
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
              <div className="p-6">
                {recentUsers.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center gap-3 p-4 hover:bg-slate-700/50 rounded-lg mb-2 transition-all"
                  >
                    <div className="w-10 h-10 bg-blue-500/20 text-blue-400 rounded-full flex items-center justify-center font-semibold">
                      {u.first_name.charAt(0)}{u.last_name.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-medium text-sm">{u.first_name} {u.last_name}</p>
                      <p className="text-xs text-slate-400">{u.organization_name} • {u.role}</p>
                    </div>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      u.is_active
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* System Activity */}
          <div className="mt-6 bg-slate-800 border border-slate-700 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <Activity className="w-6 h-6 text-green-400" />
              <h2 className="text-xl font-bold text-white">System Overview</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-slate-400 mb-2">Active Rate</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold text-white">
                    {stats.total_users > 0 
                      ? Math.round((stats.active_users / stats.total_users) * 100)
                      : 0}%
                  </p>
                  <TrendingUp className="w-4 h-4 text-green-400" />
                </div>
              </div>
              <div>
                <p className="text-sm text-slate-400 mb-2">Avg Users per Org</p>
                <p className="text-2xl font-bold text-white">
                  {stats.total_tenants > 0 
                    ? Math.round(stats.total_users / stats.total_tenants)
                    : 0}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-400 mb-2">MSP Distribution</p>
                <p className="text-2xl font-bold text-white">
                  {stats.total_tenants > 0 
                    ? Math.round((stats.msp_count / stats.total_tenants) * 100)
                    : 0}%
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GreenAdminDashboard;