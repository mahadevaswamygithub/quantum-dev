import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import PageSpinner from '../components/common/PageSpinner';
import { useAuth } from '../context/AuthContext';
import { tenantAPI, userAPI } from '../services/api';
import {
  Building2, Users, ArrowLeft, Calendar, CheckCircle,
  Shield, UserCircle, Plus, Edit, Trash2, ToggleLeft, ToggleRight,
  Eye, ChevronRight
} from 'lucide-react';
import { AddUserModal, EditUserModal, DeleteUserModal } from '../components/UserModals';

const OrganizationDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [org, setOrg] = useState(null);
  const [orgUsers, setOrgUsers] = useState([]);
  const [allOrgs, setAllOrgs] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const [showAddUser, setShowAddUser] = useState(false);
  const [showEditUser, setShowEditUser] = useState(false);
  const [showDeleteUser, setShowDeleteUser] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const basePath = '/msp';

  const fetchData = useCallback(async () => {
    try {
      const [orgRes, usersRes, statsRes, allOrgsRes, allUsersRes] = await Promise.all([
        tenantAPI.getTenantById(id),
        tenantAPI.getTenantUsers(id),
        tenantAPI.getTenantStats(id),
        tenantAPI.getTenants(),
        userAPI.getUsers(),
      ]);
      setOrg(orgRes.data);
      setOrgUsers(usersRes.data || []);
      setStats(statsRes.data);
      setAllOrgs(allOrgsRes.data || []);
      setAllUsers(allUsersRes.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleToggleUser = async (userId) => {
    try { await userAPI.toggleUserStatus(userId); await fetchData(); }
    catch (err) { alert(err.response?.data?.error || 'Failed'); }
  };

  const confirmDeleteUser = async () => {
    if (!selectedUser) return;
    setDeleteLoading(true);
    try {
      await userAPI.deleteUser(selectedUser.id);
      await fetchData();
      setShowDeleteUser(false);
      setSelectedUser(null);
    } catch (err) { alert(err.response?.data?.error || 'Failed'); }
    finally { setDeleteLoading(false); }
  };

  if (loading) return <PageSpinner />;

  if (!org) return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
      <p className="text-slate-500 dark:text-slate-400">Organization not found</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Navbar />
      <div className="flex">
        <Sidebar userRole={user.role} tenants={allOrgs} users={allUsers} collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(p => !p)} />

        <div className="flex-1 p-6 overflow-auto">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-5">
            <button onClick={() => navigate(`${basePath}/organizations`)} className="hover:text-slate-900 dark:hover:text-white transition-colors flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" /> Organizations
            </button>
            <ChevronRight className="w-3 h-3" />
            <span className="text-slate-900 dark:text-white">{org.name}</span>
          </div>

          {/* Org Header */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 mb-5">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                org.tenant_type === 'MSP' ? 'bg-green-500/20 text-green-600 dark:text-green-400' : 'bg-purple-500/20 text-purple-600 dark:text-purple-400'
              }`}>
                <Building2 className="w-7 h-7" />
              </div>
              <div className="flex-1">
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">{org.name}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                    org.tenant_type === 'MSP' ? 'bg-green-500/20 text-green-600 dark:text-green-400' : 'bg-purple-500/20 text-purple-600 dark:text-purple-400'
                  }`}>{org.tenant_type}</span>
                  <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                    org.is_active ? 'bg-green-500/20 text-green-600 dark:text-green-400' : 'bg-red-500/20 text-red-600 dark:text-red-400'
                  }`}>{org.is_active ? 'Active' : 'Inactive'}</span>
                  {org.parent_name && (
                    <span className="text-xs text-slate-500 dark:text-slate-400">Parent: <span className="text-slate-600 dark:text-slate-300">{org.parent_name}</span></span>
                  )}
                </div>
              </div>
              <div className="text-right text-sm text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-1 justify-end">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{new Date(org.created_on).toLocaleDateString()}</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-500 mt-0.5">{org.schema_name}</p>
              </div>
            </div>
          </div>

          {/* Stats row */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              {[
                { label: 'Total Users', value: stats.total_users, icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                { label: 'Active Users', value: stats.active_users, icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/10' },
                { label: 'Admins', value: stats.admins, icon: Shield, color: 'text-purple-400', bg: 'bg-purple-500/10' },
                { label: 'Regular Users', value: stats.regular_users, icon: UserCircle, color: 'text-orange-400', bg: 'bg-orange-500/10' },
              ].map((s, i) => {
                const Icon = s.icon;
                return (
                  <div key={i} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                    <div className={`w-8 h-8 ${s.bg} rounded-lg flex items-center justify-center mb-2`}>
                      <Icon className={`w-4 h-4 ${s.color}`} />
                    </div>
                    <p className="text-xl font-bold text-slate-900 dark:text-white">{s.value}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{s.label}</p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Users List */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900 dark:text-white">Users in {org.name}</h2>
              <button
                onClick={() => setShowAddUser(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-medium rounded-lg transition-all"
              >
                <Plus className="w-3.5 h-3.5" /> Add User
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-700/50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">User</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Email</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Role</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Status</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Joined</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {orgUsers.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-5 py-10 text-center">
                        <Users className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                        <p className="text-slate-500 dark:text-slate-400 text-sm">No users in this organization</p>
                      </td>
                    </tr>
                  ) : (
                    orgUsers.map(u => (
                      <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="px-5 py-3">
                          <button
                            onClick={() => navigate(`${basePath}/users/${u.id}`)}
                            className="flex items-center gap-3 group"
                          >
                            <div className="w-8 h-8 bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                              {u.first_name?.[0]}{u.last_name?.[0]}
                            </div>
                            <span className="text-slate-900 dark:text-white text-sm font-medium group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
                              {u.first_name} {u.last_name}
                            </span>
                          </button>
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
                        <td className="px-5 py-3 text-slate-500 dark:text-slate-400 text-sm">{new Date(u.created_at).toLocaleDateString()}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => navigate(`${basePath}/users/${u.id}`)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors" title="View Details">
                              <Eye className="w-4 h-4 text-green-400" />
                            </button>
                            <button onClick={() => handleToggleUser(u.id)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors" title={u.is_active ? 'Deactivate' : 'Activate'}>
                              {u.is_active ? <ToggleRight className="w-4 h-4 text-green-400" /> : <ToggleLeft className="w-4 h-4 text-slate-400" />}
                            </button>
                            <button onClick={() => { setSelectedUser(u); setShowEditUser(true); }} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors" title="Edit">
                              <Edit className="w-4 h-4 text-blue-400" />
                            </button>
                            <button onClick={() => { setSelectedUser(u); setShowDeleteUser(true); }} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors" title="Delete">
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </button>
                          </div>
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

      <AddUserModal isOpen={showAddUser} onClose={() => setShowAddUser(false)} onSuccess={fetchData} organizations={allOrgs} currentOrgId={parseInt(id)} />
      <EditUserModal isOpen={showEditUser} onClose={() => { setShowEditUser(false); setSelectedUser(null); }} onSuccess={fetchData} user={selectedUser} organizations={allOrgs} />
      <DeleteUserModal isOpen={showDeleteUser} onClose={() => { setShowDeleteUser(false); setSelectedUser(null); }} onConfirm={confirmDeleteUser} user={selectedUser} loading={deleteLoading} />
    </div>
  );
};

export default OrganizationDetail;