import React, { useState, useEffect, useCallback } from 'react';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import RefreshButton from '../components/common/RefreshButton';
import { usePermissions } from '../hooks/usePermissions';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import Pagination from '../components/common/Pagination';
import SearchFilterBar from '../components/common/SearchFilterBar';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import { useAuth } from '../context/AuthContext';
import { userAPI, tenantAPI } from '../services/api';
import {
  Users, UserPlus, Edit, Trash2, ToggleLeft, ToggleRight,
  Download, FileText, Shield, Mail, ShieldOff
} from 'lucide-react';
import { AddUserModal, EditUserModal, DeleteUserModal, ROLE_OPTIONS } from '../components/UserModals';
import BulkActions from '../components/BulkActions';
import AdvancedFilters from '../components/AdvancedFilters';
import Avatar from '../components/common/Avatar';

const PAGE_SIZE = 15;

const UsersList = () => {
  const { can } = usePermissions();
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Selection states
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  
  // Filter states
  const [advancedFilters, setAdvancedFilters] = useState(null);
  const [page, setPage] = useState(1);
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [usersResponse, tenantsResponse] = await Promise.all([
        userAPI.getUsers(),
        tenantAPI.getTenants(),
      ]);
      setUsers(usersResponse.data || []);
      setTenants(tenantsResponse.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, []);
  const live = useAutoRefresh(fetchData);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const isMSP = user.role === 'MSP_ADMIN' || user.role === 'MSP_USER';

  // userAPI.getUsers() intentionally returns MSP staff + every managed
  // sub-org's staff flattened together (UserViewSet.get_queryset - needed
  // for bulk ops/exports/stats elsewhere). This page is "manage MY
  // organization's people" though, so it defaults to just that org - a
  // sub-org's staff is managed from that org's own detail page instead
  // (Organizations → org → View Users).
  const ownOrgUsers = isMSP
    ? users.filter(u => u.organization_id === user.organization_id)
    : users;

  // tenantAPI.getTenants() deliberately excludes the MSP's own org (it
  // backs the Organizations page, which lists *sub*-orgs only - see
  // OrganizationViewSet.get_queryset). The Add/Edit User modals need the
  // MSP's own org as a pickable target too, so it's synthesized here from
  // the logged-in user's own profile fields and prepended.
  const orgOptionsForModals = isMSP
    ? [{ id: user.organization_id, name: user.organization_name, tenant_type: 'MSP', is_active: true }, ...tenants]
    : tenants;

  const filteredUsers = ownOrgUsers.filter((u) => {
    const matchesSearch = 
      u.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;

    // Apply advanced filters
    if (advancedFilters) {
      if (advancedFilters.role !== 'ALL' && u.role !== advancedFilters.role) return false;
      if (advancedFilters.status === 'ACTIVE' && !u.is_active) return false;
      if (advancedFilters.status === 'INACTIVE' && u.is_active) return false;
      if (advancedFilters.organization !== 'ALL' && u.organization?.id !== parseInt(advancedFilters.organization)) return false;
      if (advancedFilters.dateFrom && new Date(u.created_at) < new Date(advancedFilters.dateFrom)) return false;
      if (advancedFilters.dateTo && new Date(u.created_at) > new Date(advancedFilters.dateTo)) return false;
    }

    return true;
  });

  // Filters reshuffle the result set - back to page 1 so pagination doesn't
  // land on an out-of-range/empty page.
  useEffect(() => { setPage(1); }, [searchTerm, advancedFilters]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageUsers = filteredUsers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Selection handlers
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedUsers(filteredUsers.map(u => u.id));
      setSelectAll(true);
    } else {
      setSelectedUsers([]);
      setSelectAll(false);
    }
  };

  const handleSelectUser = (userId) => {
    setSelectedUsers(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId);
      } else {
        return [...prev, userId];
      }
    });
  };

  // Bulk operations
  const handleBulkActivate = async () => {
    try {
      await userAPI.bulkActivate(selectedUsers);
      await fetchData();
      setSelectedUsers([]);
      setSelectAll(false);
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to activate users');
    }
  };

  const handleBulkDeactivate = async () => {
    try {
      await userAPI.bulkDeactivate(selectedUsers);
      await fetchData();
      setSelectedUsers([]);
      setSelectAll(false);
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to deactivate users');
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete ${selectedUsers.length} users?`)) {
      return;
    }
    
    try {
      await userAPI.bulkDelete(selectedUsers);
      await fetchData();
      setSelectedUsers([]);
      setSelectAll(false);
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to delete users');
    }
  };

  const handleBulkChangeRole = () => {
    setShowRoleModal(true);
  };

  const handleRoleChange = async (newRole) => {
    try {
      await userAPI.bulkChangeRole(selectedUsers, newRole);
      await fetchData();
      setSelectedUsers([]);
      setSelectAll(false);
      setShowRoleModal(false);
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to change role');
    }
  };

  // Export handlers
  const handleExportCSV = async () => {
    try {
      const response = await userAPI.exportCSV();
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `users_${new Date().toISOString()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      alert('Failed to export CSV');
    }
  };

  const handleExportJSON = async () => {
    try {
      const response = await userAPI.exportJSON();
      const url = window.URL.createObjectURL(new Blob([JSON.stringify(response.data, null, 2)]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `users_${new Date().toISOString()}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      alert('Failed to export JSON');
    }
  };

  // Single operations
  const handleEdit = (u) => {
    setSelectedUser(u);
    setShowEditModal(true);
  };

  const handleDelete = (u) => {
    setSelectedUser(u);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!selectedUser) return;
    
    setDeleteLoading(true);
    try {
      await userAPI.deleteUser(selectedUser.id);
      await fetchData();
      setShowDeleteModal(false);
      setSelectedUser(null);
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to delete user');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleReset2fa = async (u) => {
    if (!window.confirm(`Reset two-step verification for ${u.first_name} ${u.last_name}? They'll be signed out and must set it up again (if required) at next sign-in.`)) return;
    try {
      const { data } = await userAPI.reset2fa(u.id);
      alert(data.message);
      await fetchData();
    } catch (error) {
      alert(error.response?.data?.error || error.response?.data?.detail || 'Failed to reset two-step verification');
    }
  };

  const handleResendInvite = async (u) => {
    try {
      const { data } = await userAPI.resendInvite(u.id);
      alert(data.message || `Invite sent to ${u.email}.`);
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to resend the invite');
    }
  };

  const handleToggleStatus = async (userId) => {
    try {
      await userAPI.toggleUserStatus(userId);
      await fetchData();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to toggle user status');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <p className="text-slate-500 dark:text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-slate-50 dark:bg-slate-900 flex flex-col">
      <Navbar />

      <div className="flex flex-1 min-h-0">
        <Sidebar
          userRole={user.role}
          tenants={tenants}
          users={ownOrgUsers}
        />

        <div className="flex-1 p-3 sm:p-6 overflow-hidden min-h-0 flex flex-col">
          {/* Static header + toolbar - only the table below scrolls.
              Same structure/sizing as every other listing page (Organizations,
              Rooms, Properties, Activity Log): title+icon+description on the
              left, primary Add action on the right, search/filters below. */}
          <div className="flex-shrink-0">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4 sm:mb-6">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Users className="w-6 h-6 text-green-500" /> Users Management
                </h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">Manage all users in your organization</p>
              </div>
              <div className="flex items-center gap-3">
                <Button icon={UserPlus} hidden={!can('users.manage')} onClick={() => setShowAddModal(true)}>Add User</Button>
                <RefreshButton onClick={live.refresh} refreshing={live.refreshing} lastUpdated={live.lastUpdated} />
              </div>
            </div>

            {/* Search, Filters */}
            <SearchFilterBar search={searchTerm} onSearchChange={setSearchTerm} placeholder="Search users...">
              <AdvancedFilters
                onApplyFilters={setAdvancedFilters}
                onClearFilters={() => setAdvancedFilters(null)}
                filterOptions={{
                  showRole: true,
                  // No "Organization" filter here - this page is scoped
                  // to your own org's users by default (see ownOrgUsers
                  // above), so there's nothing else left to filter by.
                  // Sub-org staff are managed from that org's own page.
                }}
              />
            </SearchFilterBar>

            {/* Export */}
            <div className="flex items-center gap-2 mb-5">
              <Button variant="secondary" icon={Download} onClick={handleExportCSV}>Export CSV</Button>
              <Button variant="secondary" icon={FileText} onClick={handleExportJSON}>Export JSON</Button>
              <span className="text-sm text-slate-500 dark:text-slate-400 ml-2">
                {filteredUsers.length} users found
              </span>
            </div>
          </div>

          {/* Users Table - scrollable. overflow-auto lives directly on this
              card (not a nested overflow-x-auto wrapper) so the sticky thead
              below has one real scrolling ancestor to stick within. */}
          <div className="flex-1 overflow-auto min-h-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
              <table className="w-full">
                <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-700/50">
                  <tr>
                    <th className="px-6 py-4 text-left">
                      <input
                        type="checkbox"
                        checked={selectAll}
                        onChange={handleSelectAll}
                        className="w-5 h-5 rounded border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 text-green-500"
                      />
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                      User
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                      Email
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                      Role
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                      Organization
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
                        No users found
                      </td>
                    </tr>
                  ) : (
                    pageUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            checked={selectedUsers.includes(u.id)}
                            onChange={() => handleSelectUser(u.id)}
                            className="w-5 h-5 rounded border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 text-green-500"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <Avatar
                              src={u.profile_picture}
                              initials={`${u.first_name.charAt(0)}${u.last_name.charAt(0)}`}
                              className="w-10 h-10 rounded-full"
                              bg="bg-blue-500/20"
                              textClass="text-blue-600 dark:text-blue-400"
                            />
                            <span className="text-slate-900 dark:text-white font-medium">
                              {u.first_name} {u.last_name}
                            </span>
                            {u.invite_pending && (
                              <span title="Hasn't set a password yet" className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 whitespace-nowrap">
                                Invite pending
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{u.email}</td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400">
                            {u.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{u.organization_name || 'N/A'}</td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                            u.is_active
                              ? 'bg-green-500/20 text-green-600 dark:text-green-400'
                              : 'bg-red-500/20 text-red-600 dark:text-red-400'
                          }`}>
                            {u.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              hidden={!can('users.manage') || !u.two_factor_enabled || u.id === user.id}
                              onClick={() => handleReset2fa(u)}
                              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-lg transition-colors"
                              title="Reset two-step verification (lost phone)"
                            >
                              <ShieldOff className="w-4 h-4 text-purple-500" />
                            </button>
                            <button
                              hidden={!can('users.manage') || !u.invite_pending}
                              onClick={() => handleResendInvite(u)}
                              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-lg transition-colors"
                              title="Resend invite email"
                            >
                              <Mail className="w-4 h-4 text-amber-500" />
                            </button>
                            <button
                              hidden={!can('users.manage')}
                              onClick={() => handleToggleStatus(u.id)}
                              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-lg transition-colors"
                              title={u.is_active ? 'Deactivate' : 'Activate'}
                            >
                              {u.is_active ? (
                                <ToggleRight className="w-4 h-4 text-green-400" />
                              ) : (
                                <ToggleLeft className="w-4 h-4 text-slate-400" />
                              )}
                            </button>
                            <button
                              hidden={!can('users.manage')}
                              onClick={() => handleEdit(u)}
                              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4 text-blue-400" />
                            </button>
                            <button
                              hidden={!can('users.manage')}
                              onClick={() => handleDelete(u)}
                              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-lg transition-colors"
                              title="Delete"
                            >
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

          <Pagination
            page={currentPage}
            totalPages={totalPages}
            onPageChange={setPage}
            rangeStart={(currentPage - 1) * PAGE_SIZE + 1}
            rangeEnd={Math.min(currentPage * PAGE_SIZE, filteredUsers.length)}
            totalCount={filteredUsers.length}
            itemLabel="users"
          />
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {can('users.manage') && (
      <BulkActions
        selectedCount={selectedUsers.length}
        onActivate={handleBulkActivate}
        onDeactivate={handleBulkDeactivate}
        onDelete={handleBulkDelete}
        onChangeRole={handleBulkChangeRole}
        onClearSelection={() => {
          setSelectedUsers([]);
          setSelectAll(false);
        }}
        showRoleChange={true}
      />
      )}

      {/* Modals */}
      <AddUserModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={fetchData}
        organizations={orgOptionsForModals}
        currentOrgId={user.organization_id}
        currentOrgType={user.role.startsWith('MSP') ? 'MSP' : 'STP'}
      />

      <EditUserModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedUser(null);
        }}
        onSuccess={fetchData}
        user={selectedUser}
        organizations={orgOptionsForModals}
        currentOrgType={user.role.startsWith('MSP') ? 'MSP' : 'STP'}
      />

      <DeleteUserModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedUser(null);
        }}
        onConfirm={confirmDelete}
        user={selectedUser}
        loading={deleteLoading}
      />

      {/* Role Change Modal */}
      {showRoleModal && (
        <RoleChangeModal
          isOpen={showRoleModal}
          onClose={() => setShowRoleModal(false)}
          onConfirm={handleRoleChange}
          selectedCount={selectedUsers.length}
          currentOrgType={user.role.startsWith('MSP') ? 'MSP' : 'STP'}
        />
      )}
    </div>
  );
};

// Role Change Modal Component
const RoleChangeModal = ({ isOpen, onClose, onConfirm, selectedCount, currentOrgType = 'STP' }) => {
  // Bulk role changes only offer roles that fit the acting admin's own
  // scope (an STP admin's selection is always STP-org users) - the same
  // MSP/STP mismatch guard as Add/Edit User, see UserModals.jsx.
  const roleOptions = ROLE_OPTIONS[currentOrgType] || ROLE_OPTIONS.STP;
  const [newRole, setNewRole] = useState(roleOptions[0].value);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Change Role">
      <div className="p-6">
        <p className="text-slate-600 dark:text-slate-300 mb-6">
          Select a new role for {selectedCount} selected user(s)
        </p>

        <select
          value={newRole}
          onChange={(e) => setNewRole(e.target.value)}
          className="w-full px-4 py-2.5 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500 mb-6"
        >
          {roleOptions.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white text-sm font-medium rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(newRole)}
            className="flex-1 px-4 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2"
          >
            <Shield className="w-4 h-4" />
            Change Role
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default UsersList;