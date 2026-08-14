import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import PageSpinner from '../components/common/PageSpinner';
import { useAuth } from '../context/AuthContext';
import { tenantAPI, userAPI } from '../services/api';
import {
  Building2, Search, Plus, Edit, Trash2, ToggleLeft, ToggleRight,
  ArrowRight, Users, ChevronRight, LayoutGrid, List, LogIn, Eye
} from 'lucide-react';
import { AddOrganizationModal, EditOrganizationModal, DeleteOrganizationModal } from '../components/OrganizationModals';
import { orgTypeLabel } from '../constants/orgTypes';

const OrganizationsList = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [organizations, setOrganizations] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [viewMode, setViewMode] = useState('card'); // 'card' | 'table'

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const isMSP = user.role === 'MSP_ADMIN' || user.role === 'MSP_USER';
  const basePath = '/msp';

  const fetchData = useCallback(async () => {
    try {
      const [orgsRes, usersRes] = await Promise.all([
        tenantAPI.getTenants(),
        userAPI.getUsers(),
      ]);
      setOrganizations(orgsRes.data || []);
      setAllUsers(usersRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = organizations.filter(o => {
    const matchSearch = o.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = filterStatus === 'ALL' || (filterStatus === 'ACTIVE' ? o.is_active : !o.is_active);
    return matchSearch && matchStatus;
  });

  const handleToggle = async (id, e) => {
    e.stopPropagation();
    try { await tenantAPI.toggleTenantStatus(id); await fetchData(); }
    catch (err) { alert(err.response?.data?.error || 'Failed'); }
  };

  const handleImpersonate = async (id, e) => {
    e.stopPropagation();
    try {
      const { data } = await tenantAPI.impersonateOrganization(id);
      window.open(`/impersonate/${data.code}`, '_blank');
    } catch (err) { alert(err.response?.data?.error || 'Failed to start impersonation'); }
  };

  const confirmDelete = async () => {
    if (!selectedOrg) return;
    setDeleteLoading(true);
    try {
      await tenantAPI.deleteTenant(selectedOrg.id);
      await fetchData();
      setShowDeleteModal(false);
      setSelectedOrg(null);
    } catch (err) { alert(err.response?.data?.error || 'Failed to delete'); }
    finally { setDeleteLoading(false); }
  };

  if (loading) return <PageSpinner label="Loading..." />;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Navbar />
      <div className="flex">
        <Sidebar
          userRole={user.role}
          tenants={organizations}
          users={allUsers}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(p => !p)}
        />

        <div className="flex-1 p-6 overflow-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Organizations</h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">{filtered.length} of {organizations.length} organizations</p>
            </div>
            {isMSP && (
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white text-sm font-semibold rounded-lg transition-all"
              >
                <Plus className="w-4 h-4" /> Add Organization
              </button>
            )}
          </div>

          {/* Toolbar */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 mb-5 flex flex-wrap gap-3 items-center">
            <div className="flex-1 min-w-48 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search organizations..."
                className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
              <button
                onClick={() => setViewMode('card')}
                className={`p-1.5 rounded-md transition-all ${viewMode === 'card' ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-md transition-all ${viewMode === 'table' ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Card View */}
          {viewMode === 'card' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(org => (
                <div
                  key={org.id}
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 hover:border-slate-300 dark:hover:border-slate-600 transition-all group relative"
                >
                  {/* Action buttons - top right */}
                  <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={e => { e.stopPropagation(); navigate(`${basePath}/organizations/${org.id}`); }}
                      className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                      title="View Details"
                    >
                      <Eye className="w-4 h-4 text-green-400" />
                    </button>
                    {org.tenant_type === 'STP' && (
                      <button
                        onClick={e => handleImpersonate(org.id, e)}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        title="Impersonate admin (opens in a new tab)"
                      >
                        <LogIn className="w-4 h-4 text-purple-400" />
                      </button>
                    )}
                    <button
                      onClick={e => handleToggle(org.id, e)}
                      className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                      title={org.is_active ? 'Deactivate' : 'Activate'}
                    >
                      {org.is_active
                        ? <ToggleRight className="w-4 h-4 text-green-400" />
                        : <ToggleLeft className="w-4 h-4 text-slate-400" />}
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); setSelectedOrg(org); setShowEditModal(true); }}
                      className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4 text-blue-400" />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); setSelectedOrg(org); setShowDeleteModal(true); }}
                      className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>

                  {/* Clickable card body → opens users list */}
                  <div
                    className="cursor-pointer"
                    onClick={() => navigate(`${basePath}/organizations/${org.id}`)}
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        org.tenant_type === 'MSP' ? 'bg-green-500/20 text-green-600 dark:text-green-400' : 'bg-purple-500/20 text-purple-600 dark:text-purple-400'
                      }`}>
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-slate-900 dark:text-white font-semibold text-sm truncate group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors pr-16">
                          {org.name}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-500 truncate mt-0.5">{org.schema_name}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mb-3">
                      <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                        org.tenant_type === 'MSP' ? 'bg-green-500/20 text-green-600 dark:text-green-400' : 'bg-purple-500/20 text-purple-600 dark:text-purple-400'
                      }`}>
                        {org.tenant_type}
                      </span>
                      {org.org_type && (
                        <span className="px-2 py-0.5 text-xs rounded-full font-medium bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                          {orgTypeLabel(org.org_type)}
                        </span>
                      )}
                      <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                        org.is_active ? 'bg-green-500/20 text-green-600 dark:text-green-400' : 'bg-red-500/20 text-red-600 dark:text-red-400'
                      }`}>
                        {org.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-700 pt-3">
                      <div className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        <span>{org.user_count || 0} users</span>
                      </div>
                      <div className="flex items-center gap-1 text-green-600 dark:text-green-400 group-hover:gap-2 transition-all">
                        <span>View Users</span>
                        <ChevronRight className="w-3 h-3" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Table View */}
          {viewMode === 'table' && (
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 dark:bg-slate-700/50">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Organization</th>
                      <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Type</th>
                      <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Users</th>
                      <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Status</th>
                      <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {filtered.map(org => (
                      <tr key={org.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="px-5 py-4">
                          <button
                            onClick={() => navigate(`${basePath}/organizations/${org.id}`)}
                            className="flex items-center gap-3 text-left group"
                          >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                              org.tenant_type === 'MSP' ? 'bg-green-500/20 text-green-600 dark:text-green-400' : 'bg-purple-500/20 text-purple-600 dark:text-purple-400'
                            }`}>
                              <Building2 className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-slate-900 dark:text-white font-medium text-sm group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">{org.name}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-500">{org.schema_name}</p>
                            </div>
                          </button>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                              org.tenant_type === 'MSP' ? 'bg-green-500/20 text-green-600 dark:text-green-400' : 'bg-purple-500/20 text-purple-600 dark:text-purple-400'
                            }`}>{org.tenant_type}</span>
                            {org.org_type && (
                              <span className="px-2 py-0.5 text-xs rounded-full font-medium bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                                {orgTypeLabel(org.org_type)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-slate-500 dark:text-slate-400 text-sm">{org.user_count || 0}</td>
                        <td className="px-5 py-4">
                          <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                            org.is_active ? 'bg-green-500/20 text-green-600 dark:text-green-400' : 'bg-red-500/20 text-red-600 dark:text-red-400'
                          }`}>{org.is_active ? 'Active' : 'Inactive'}</span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1">
                            {org.tenant_type === 'STP' && (
                              <button onClick={e => handleImpersonate(org.id, e)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors" title="Impersonate admin (opens in a new tab)">
                                <LogIn className="w-4 h-4 text-purple-400" />
                              </button>
                            )}
                            <button onClick={e => handleToggle(org.id, e)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors" title={org.is_active ? 'Deactivate' : 'Activate'}>
                              {org.is_active ? <ToggleRight className="w-4 h-4 text-green-400" /> : <ToggleLeft className="w-4 h-4 text-slate-400" />}
                            </button>
                            <button onClick={() => { setSelectedOrg(org); setShowEditModal(true); }} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors" title="Edit">
                              <Edit className="w-4 h-4 text-blue-400" />
                            </button>
                            <button onClick={() => { setSelectedOrg(org); setShowDeleteModal(true); }} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors" title="Delete">
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </button>
                            <button onClick={() => navigate(`${basePath}/organizations/${org.id}`)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors" title="View Details">
                              <ArrowRight className="w-4 h-4 text-green-400" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filtered.length === 0 && (
                <div className="text-center py-12">
                  <Building2 className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-500 dark:text-slate-400">No organizations found</p>
                </div>
              )}
            </div>
          )}

          {filtered.length === 0 && viewMode === 'card' && (
            <div className="text-center py-16">
              <Building2 className="w-14 h-14 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <h3 className="text-slate-900 dark:text-white font-semibold mb-1">No organizations found</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm">Try adjusting your search or filters</p>
            </div>
          )}
        </div>
      </div>

      <AddOrganizationModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} onSuccess={fetchData} parentOrgId={isMSP ? user.organization_id : null} />
      <EditOrganizationModal isOpen={showEditModal} onClose={() => { setShowEditModal(false); setSelectedOrg(null); }} onSuccess={fetchData} organization={selectedOrg} />
      <DeleteOrganizationModal isOpen={showDeleteModal} onClose={() => { setShowDeleteModal(false); setSelectedOrg(null); }} onConfirm={confirmDelete} organization={selectedOrg} loading={deleteLoading} />
    </div>
  );
};

export default OrganizationsList;