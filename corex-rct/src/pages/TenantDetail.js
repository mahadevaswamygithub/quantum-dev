import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import { tenantAPI, userAPI } from '../services/api';
import { 
  Building2, 
  Users, 
  ArrowLeft, 
  Mail, 
  Phone, 
  Calendar,
  CheckCircle,
  XCircle,
  Shield,
  UserCircle
} from 'lucide-react';

const TenantDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [tenant, setTenant] = useState(null);
  const [tenantUsers, setTenantUsers] = useState([]);
  const [allTenants, setAllTenants] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const isGreenAdmin = user.role === 'GREEN_ADMIN';
  const isMSP = user.role === 'MSP_ADMIN' || user.role === 'MSP_USER';
  const basePath = isGreenAdmin ? '/green-admin' : '/msp';

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      const [tenantResponse, usersResponse, statsResponse, allTenantsResponse, allUsersResponse] = await Promise.all([
        tenantAPI.getTenantById(id),
        tenantAPI.getTenantUsers(id),
        tenantAPI.getTenantStats(id),
        tenantAPI.getTenants(),
        userAPI.getUsers(),
      ]);
      
      setTenant(tenantResponse.data);
      setTenantUsers(usersResponse.data || []);
      setStats(statsResponse.data);
      setAllTenants(allTenantsResponse.data || []);
      setAllUsers(allUsersResponse.data || []);
    } catch (error) {
      console.error('Error fetching tenant details:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900">
        <Navbar />
        <div className="flex">
          <Sidebar userRole={user.role} tenants={[]} users={[]} />
          <div className="flex-1 flex items-center justify-center">
            <p className="text-slate-400">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen bg-slate-900">
        <Navbar />
        <div className="flex">
          <Sidebar userRole={user.role} tenants={[]} users={[]} />
          <div className="flex-1 flex items-center justify-center">
            <p className="text-slate-400">Tenant not found</p>
          </div>
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
          tenants={allTenants}
          users={allUsers}
        />
        
        <div className="flex-1 p-8">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => navigate(`${basePath}/tenants`)}
              className="flex items-center gap-2 text-slate-400 hover:text-white mb-4 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Tenants
            </button>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${
                  tenant.tenant_type === 'MSP'
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-purple-500/20 text-purple-400'
                }`}>
                  <Building2 className="w-8 h-8" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-white mb-1">{tenant.name}</h1>
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                      tenant.tenant_type === 'MSP'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-purple-500/20 text-purple-400'
                    }`}>
                      {tenant.tenant_type}
                    </span>
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                      tenant.is_active
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {tenant.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <Users className="w-10 h-10 text-blue-400" />
                </div>
                <p className="text-3xl font-bold text-white mb-1">{stats.total_users}</p>
                <p className="text-sm text-slate-400">Total Users</p>
              </div>

              <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <CheckCircle className="w-10 h-10 text-green-400" />
                </div>
                <p className="text-3xl font-bold text-white mb-1">{stats.active_users}</p>
                <p className="text-sm text-slate-400">Active Users</p>
              </div>

              <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <Shield className="w-10 h-10 text-purple-400" />
                </div>
                <p className="text-3xl font-bold text-white mb-1">{stats.admins}</p>
                <p className="text-sm text-slate-400">Administrators</p>
              </div>

              <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <UserCircle className="w-10 h-10 text-orange-400" />
                </div>
                <p className="text-3xl font-bold text-white mb-1">{stats.regular_users}</p>
                <p className="text-sm text-slate-400">Regular Users</p>
              </div>
            </div>
          )}

          {/* Tenant Information */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-6">
            <h2 className="text-xl font-bold text-white mb-4">Organization Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-slate-400 mb-1">Schema Name</p>
                <p className="text-white font-medium">{tenant.schema_name}</p>
              </div>
              <div>
                <p className="text-sm text-slate-400 mb-1">Organization Type</p>
                <p className="text-white font-medium">{tenant.tenant_type}</p>
              </div>
              <div>
                <p className="text-sm text-slate-400 mb-1">Created Date</p>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <p className="text-white font-medium">
                    {new Date(tenant.created_on).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-sm text-slate-400 mb-1">Status</p>
                <div className="flex items-center gap-2">
                  {tenant.is_active ? (
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400" />
                  )}
                  <p className="text-white font-medium">
                    {tenant.is_active ? 'Active' : 'Inactive'}
                  </p>
                </div>
              </div>
              {tenant.parent_name && (
                <div>
                  <p className="text-sm text-slate-400 mb-1">Parent Organization</p>
                  <p className="text-white font-medium">{tenant.parent_name}</p>
                </div>
              )}
              {tenant.domains && tenant.domains.length > 0 && (
                <div>
                  <p className="text-sm text-slate-400 mb-1">Domains</p>
                  {tenant.domains.map((domain, index) => (
                    <p key={index} className="text-white font-medium">
                      {domain.domain} {domain.is_primary && '(Primary)'}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            <div className="p-6 border-b border-slate-700">
              <h2 className="text-xl font-bold text-white">Users in this Organization</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-700/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase">
                      User
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase">
                      Email
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase">
                      Role
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase">
                      Joined
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {tenantUsers.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-6 py-8 text-center text-slate-400">
                        No users found in this organization
                      </td>
                    </tr>
                  ) : (
                    tenantUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-700/30">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-500/20 text-blue-400 rounded-full flex items-center justify-center font-semibold">
                              {u.first_name.charAt(0)}{u.last_name.charAt(0)}
                            </div>
                            <span className="text-white font-medium">
                              {u.first_name} {u.last_name}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-slate-400" />
                            <span className="text-slate-400">{u.email}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-blue-500/20 text-blue-400">
                            {u.role}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                            u.is_active
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-red-500/20 text-red-400'
                          }`}>
                            {u.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-400">
                          {new Date(u.created_at).toLocaleDateString()}
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
    </div>
  );
};

export default TenantDetail;