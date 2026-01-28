import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import { tenantAPI, userAPI } from '../services/api';
import { Building2, Users, Plus, TrendingUp, X, Loader2, CheckCircle, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const MSPDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [subOrganizations, setSubOrganizations] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddTenantModal, setShowAddTenantModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    domain_name: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [tenantsResponse, usersResponse] = await Promise.all([
        tenantAPI.getTenants(),
        userAPI.getUsers(),
      ]);
      setSubOrganizations(tenantsResponse.data || []);
      setUsers(usersResponse.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTenant = () => {
    setShowAddTenantModal(true);
  };

  const handleCloseModal = () => {
    setShowAddTenantModal(false);
    setFormData({ name: '', domain_name: '' });
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      await tenantAPI.createTenant({
        ...formData,
        tenant_type: 'STP',
        parent_organization: user.organization_id,
      });

      await fetchData();
      handleCloseModal();
      alert('Tenant created successfully!');
    } catch (error) {
      console.error('Error creating tenant:', error);
      alert('Failed to create tenant. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const activeOrgs = subOrganizations.filter(o => o.is_active).length;
  const totalUsers = users.length;
  const activeUsers = users.filter(u => u.is_active).length;
  const recentActivity = users.slice(0, 5);

  const stats = [
    { 
      title: 'Sub-Organizations', 
      value: subOrganizations.length,
      change: `${activeOrgs} active`,
      icon: Building2, 
      color: 'from-blue-500 to-blue-600' 
    },
    { 
      title: 'Total Users', 
      value: totalUsers,
      change: `${activeUsers} active`,
      icon: Users, 
      color: 'from-green-500 to-green-600' 
    },
    { 
      title: 'Active Clients', 
      value: activeOrgs, 
      change: `${subOrganizations.length - activeOrgs} inactive`,
      icon: TrendingUp, 
      color: 'from-purple-500 to-purple-600' 
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      <Navbar />
      
      <div className="flex">
        <Sidebar 
          userRole={user.role} 
          tenants={subOrganizations}
          users={users}
          onAddTenant={handleAddTenant}
        />
        
        <div className="flex-1 p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">MSP Dashboard</h1>
            <p className="text-slate-400">Welcome back, {user.first_name}! Here's your overview</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {stats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <div key={index} className="bg-slate-800 border border-slate-700 rounded-xl p-6 hover:border-green-500/50 transition-all">
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
                  onClick={() => navigate('/msp/tenants')}
                  className="text-sm text-green-400 hover:text-green-300 font-medium"
                >
                  View All
                </button>
              </div>
              <div className="p-6">
                {subOrganizations.slice(0, 5).map((org) => (
                  <div
                    key={org.id}
                    onClick={() => navigate(`/msp/tenants/${org.id}`)}
                    className="flex items-center justify-between p-4 hover:bg-slate-700/50 rounded-lg mb-2 cursor-pointer transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-500/20 text-purple-400 rounded-lg flex items-center justify-center">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-white font-medium">{org.name}</p>
                        <p className="text-xs text-slate-400">{org.user_count || 0} users</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                      org.is_active
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {org.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                ))}
                {subOrganizations.length === 0 && (
                  <div className="text-center py-8">
                    <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400 mb-4">No organizations yet</p>
                    <button
                      onClick={handleAddTenant}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      Add Your First Tenant
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
              <div className="p-6 border-b border-slate-700 flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Recent Activity</h2>
                <Activity className="w-5 h-5 text-slate-400" />
              </div>
              <div className="p-6">
                {recentActivity.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center gap-3 p-4 hover:bg-slate-700/50 rounded-lg mb-2 transition-all"
                  >
                    <div className="w-10 h-10 bg-blue-500/20 text-blue-400 rounded-full flex items-center justify-center font-semibold">
                      {u.first_name.charAt(0)}{u.last_name.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-medium text-sm">{u.first_name} {u.last_name}</p>
                      <p className="text-xs text-slate-400">{u.organization_name}</p>
                    </div>
                    <span className="text-xs text-slate-500">
                      {new Date(u.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Tenant Modal */}
      {showAddTenantModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl shadow-xl max-w-md w-full border border-slate-700">
            <div className="p-6 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">Add New Tenant</h3>
              <button
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Organization Name
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Acme Corporation"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Domain Name
                </label>
                <input
                  type="text"
                  name="domain_name"
                  value={formData.domain_name}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="acme.corex.local"
                  required
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Tenant'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MSPDashboard;