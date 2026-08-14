import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import PageSpinner from '../components/common/PageSpinner';
import Pagination from '../components/common/Pagination';
import SearchFilterBar from '../components/common/SearchFilterBar';
import Button from '../components/common/Button';
import { useAuth } from '../context/AuthContext';
import { tenantAPI, userAPI } from '../services/api';
import {
  Building2, Plus, Edit, Trash2, ToggleLeft, ToggleRight,
  ArrowRight, Users, ChevronRight, LayoutGrid, List, LogIn, Eye
} from 'lucide-react';
import { AddOrganizationModal, EditOrganizationModal, DeleteOrganizationModal } from '../components/OrganizationModals';
import { orgTypeLabel } from '../constants/orgTypes';
import Avatar from '../components/common/Avatar';

const PAGE_SIZE = 12;

const OrganizationsList = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [organizations, setOrganizations] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [viewMode, setViewMode] = useState('table'); // 'card' | 'table' — table is the proper list; card grid stays available via the toggle
  const [page, setPage] = useState(1);

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

  // Filters reshuffle the result set — back to page 1 so pagination doesn't
  // land on an out-of-range/empty page.
  useEffect(() => { setPage(1); }, [searchTerm, filterStatus]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

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
    <div className="h-screen overflow-hidden bg-slate-50 dark:bg-slate-900 flex flex-col">
      <Navbar />
      <div className="flex flex-1 min-h-0">
        <Sidebar
          userRole={user.role}
          tenants={organizations}
          users={allUsers}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(p => !p)}
        />

        <div className="flex-1 p-6 overflow-hidden min-h-0 flex flex-col">
          {/* Static header + toolbar — only the records below scroll */}
          <div className="flex-shrink-0">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Organizations</h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">{filtered.length} of {organizations.length} organizations</p>
              </div>
              {isMSP && (
                <Button icon={Plus} onClick={() => setShowAddModal(true)}>Add Organization</Button>
              )}
            </div>

            {/* Toolbar */}
            <SearchFilterBar search={searchTerm} onSearchChange={setSearchTerm} placeholder="Search organizations...">
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
            </SearchFilterBar>
          </div>

          {/* Scrollable records — this wrapper only bounds the height; each
              view below owns its own single overflow-auto element sized via
              h-full, so a sticky thead (Table View) has one real scrolling
              ancestor to stick within instead of two nested ones. */}
          <div className="flex-1 min-h-0">
          {/* Card View */}
          {viewMode === 'card' && (
            <div className="h-full overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="text-center py-16">
                  <Building2 className="w-14 h-14 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                  <h3 className="text-slate-900 dark:text-white font-semibold mb-1">No organizations found</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-sm">Try adjusting your search or filters</p>
                </div>
              ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pageItems.map(org => (
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
                      <Avatar
                        src={org.logo}
                        icon={Building2}
                        className="w-10 h-10 rounded-lg"
                        bg={org.tenant_type === 'MSP' ? 'bg-green-500/20' : 'bg-purple-500/20'}
                        textClass={org.tenant_type === 'MSP' ? 'text-green-600 dark:text-green-400' : 'text-purple-600 dark:text-purple-400'}
                      />
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
            </div>
          )}

          {/* Table View */}
          {viewMode === 'table' && (
            <div className="h-full overflow-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
              {filtered.length === 0 ? (
                <div className="text-center py-12">
                  <Building2 className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-500 dark:text-slate-400">No organizations found</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-700/50">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Organization</th>
                      <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Type</th>
                      <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Users</th>
                      <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Status</th>
                      <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {pageItems.map(org => (
                      <tr key={org.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="px-5 py-4">
                          <button
                            onClick={() => navigate(`${basePath}/organizations/${org.id}`)}
                            className="flex items-center gap-3 text-left group"
                          >
                            <Avatar
                              src={org.logo}
                              icon={Building2}
                              className="w-8 h-8 rounded-lg"
                              bg={org.tenant_type === 'MSP' ? 'bg-green-500/20' : 'bg-purple-500/20'}
                              textClass={org.tenant_type === 'MSP' ? 'text-green-600 dark:text-green-400' : 'text-purple-600 dark:text-purple-400'}
                            />
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
              )}
            </div>
          )}
          </div>

          <Pagination
            page={currentPage}
            totalPages={totalPages}
            onPageChange={setPage}
            rangeStart={(currentPage - 1) * PAGE_SIZE + 1}
            rangeEnd={Math.min(currentPage * PAGE_SIZE, filtered.length)}
            totalCount={filtered.length}
            itemLabel="organizations"
          />
        </div>
      </div>

      <AddOrganizationModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} onSuccess={fetchData} parentOrgId={isMSP ? user.organization_id : null} />
      <EditOrganizationModal isOpen={showEditModal} onClose={() => { setShowEditModal(false); setSelectedOrg(null); }} onSuccess={fetchData} organization={selectedOrg} />
      <DeleteOrganizationModal isOpen={showDeleteModal} onClose={() => { setShowDeleteModal(false); setSelectedOrg(null); }} onConfirm={confirmDelete} organization={selectedOrg} loading={deleteLoading} />
    </div>
  );
};

export default OrganizationsList;