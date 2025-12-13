import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import { greenAdminAPI } from '../services/api';
import { Users, Building2, Shield, Search, Filter, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const GreenAdminDashboard = () => {
  const [users, setUsers] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [stats, setStats] = useState({
    total_tenants: 0,
    msp_count: 0,
    stp_count: 0,
    total_users: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('ALL');

  const navigate = useNavigate();
  const { user } = useAuth();

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
      });
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNavigateToTenant = (tenant) => {
    // Store tenant context
    localStorage.setItem('currentTenantId', tenant.id);
    localStorage.setItem('currentTenantName', tenant.name);
    localStorage.setItem('currentTenantType', tenant.tenant_type);

    // Navigate based on tenant type
    if (tenant.tenant_type === 'MSP') {
      navigate('/msp', { state: { tenantId: tenant.id } });
    } else {
      navigate('/stp', { state: { tenantId: tenant.id } });
    }
  };

  const filteredTenants = tenants.filter((tenant) => {
    const matchesSearch = tenant.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterType === 'ALL' || tenant.tenant_type === filterType;
    return matchesSearch && matchesFilter;
  });

  const displayStats = [
    {
      title: 'Total Tenants',
      value: stats.total_tenants || tenants.length,
      icon: Building2,
      color: 'from-blue-500 to-blue-600',
    },
    {
      title: 'MSP Organizations',
      value: stats.msp_count || tenants.filter((t) => t.tenant_type === 'MSP').length,
      icon: Shield,
      color: 'from-green-500 to-green-600',
    },
    {
      title: 'STP Organizations',
      value: stats.stp_count || tenants.filter((t) => t.tenant_type === 'STP').length,
      icon: Building2,
      color: 'from-purple-500 to-purple-600',
    },
    {
      title: 'Total Users',
      value: stats.total_users || users.length,
      icon: Users,
      color: 'from-orange-500 to-orange-600',
    },
  ];

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
      
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Green Admin Dashboard</h1>
          <p className="text-slate-400">Manage all tenants and organizations</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {displayStats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div
                key={index}
                className="bg-slate-800 border border-slate-700 rounded-xl p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-12 h-12 bg-gradient-to-br ${stat.color} rounded-lg flex items-center justify-center`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-white mb-1">{stat.value}</p>
                <p className="text-sm text-slate-400">{stat.title}</p>
              </div>
            );
          })}
        </div>

        {/* Search and Filter */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Search tenants..."
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-slate-400" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="ALL">All Types</option>
                <option value="MSP">MSP Only</option>
                <option value="STP">STP Only</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tenants Table */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <div className="p-6 border-b border-slate-700">
            <h2 className="text-xl font-bold text-white">Organizations</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-700/50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Organization
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Schema
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {filteredTenants.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-8 text-center text-slate-400">
                      No organizations found
                    </td>
                  </tr>
                ) : (
                  filteredTenants.map((tenant) => (
                    <tr key={tenant.id} className="hover:bg-slate-700/30">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            tenant.tenant_type === 'MSP' 
                              ? 'bg-green-500/20 text-green-400' 
                              : 'bg-purple-500/20 text-purple-400'
                          }`}>
                            <Building2 className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white">{tenant.name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                          tenant.tenant_type === 'MSP'
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-purple-500/20 text-purple-400'
                        }`}>
                          {tenant.tenant_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                        {tenant.schema_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                          tenant.is_active
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {tenant.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button 
                          onClick={() => handleNavigateToTenant(tenant)}
                          className="flex items-center gap-2 text-blue-400 hover:text-blue-300 font-medium transition-colors"
                        >
                          Open Portal
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GreenAdminDashboard;