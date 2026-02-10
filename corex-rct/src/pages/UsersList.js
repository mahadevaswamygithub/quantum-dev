import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import { userAPI, tenantAPI } from '../services/api';
import { 
  Search, UserPlus, Edit, Trash2, ToggleLeft, ToggleRight,
  Download, FileText, Shield
} from 'lucide-react';
import { AddUserModal, EditUserModal, DeleteUserModal } from '../components/UserModals';
import BulkActions from '../components/BulkActions';
import AdvancedFilters from '../components/AdvancedFilters';

const UsersList = () => {
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
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const isMSP = user.role === 'MSP_ADMIN' || user.role === 'MSP_USER';

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

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredUsers = users.filter((u) => {
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
    } catch (error) {
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
    } catch (error) {
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
          tenants={tenants}
          users={users}
        />
        
        <div className="flex-1 p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Users Management</h1>
            <p className="text-slate-400">Manage all users in your organization</p>
          </div>

          {/* Search, Filters and Actions */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-6">
            <div className="flex flex-col gap-4">
              {/* Search and Advanced Filters */}
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Search users..."
                  />
                </div>
                
                <AdvancedFilters
                  onApplyFilters={setAdvancedFilters}
                  onClearFilters={() => setAdvancedFilters(null)}
                  filterOptions={{
                    showRole: true,
                    organizations: tenants
                  }}
                />

                <button 
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-semibold rounded-lg transition-all whitespace-nowrap"
                >
                  <UserPlus className="w-5 h-5" />
                  Add User
                </button>
              </div>

              {/* Export Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportCSV}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
                <button
                  onClick={handleExportJSON}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm"
                >
                  <FileText className="w-4 h-4" />
                  Export JSON
                </button>
                <span className="text-sm text-slate-400 ml-2">
                  {filteredUsers.length} users found
                </span>
              </div>
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-700/50">
                  <tr>
                    <th className="px-6 py-4 text-left">
                      <input
                        type="checkbox"
                        checked={selectAll}
                        onChange={handleSelectAll}
                        className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-green-500"
                      />
                    </th>
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
                      Organization
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-6 py-8 text-center text-slate-400">
                        No users found
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-700/30">
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            checked={selectedUsers.includes(u.id)}
                            onChange={() => handleSelectUser(u.id)}
                            className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-green-500"
                          />
                        </td>
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
                        <td className="px-6 py-4 text-slate-400">{u.email}</td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-blue-500/20 text-blue-400">
                            {u.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-400">{u.organization_name || 'N/A'}</td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                            u.is_active
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-red-500/20 text-red-400'
                          }`}>
                            {u.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleToggleStatus(u.id)}
                              className="p-2 hover:bg-slate-600 rounded-lg transition-colors"
                              title={u.is_active ? 'Deactivate' : 'Activate'}
                            >
                              {u.is_active ? (
                                <ToggleRight className="w-5 h-5 text-green-400" />
                              ) : (
                                <ToggleLeft className="w-5 h-5 text-slate-400" />
                              )}
                            </button>
                            <button
                              onClick={() => handleEdit(u)}
                              className="p-2 hover:bg-slate-600 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Edit className="w-5 h-5 text-blue-400" />
                            </button>
                            <button
                              onClick={() => handleDelete(u)}
                              className="p-2 hover:bg-slate-600 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-5 h-5 text-red-400" />
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

      {/* Bulk Actions Bar */}
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

      {/* Modals */}
      <AddUserModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={fetchData}
        organizations={tenants}
        currentOrgId={user.organization_id}
      />

      <EditUserModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedUser(null);
        }}
        onSuccess={fetchData}
        user={selectedUser}
        organizations={tenants}
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
        />
      )}
    </div>
  );
};

// Role Change Modal Component
const RoleChangeModal = ({ isOpen, onClose, onConfirm, selectedCount }) => {
  const [newRole, setNewRole] = useState('STP_USER');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl shadow-xl max-w-md w-full border border-slate-700">
        <div className="p-6">
          <h3 className="text-xl font-bold text-white mb-4">Change Role</h3>
          <p className="text-slate-300 mb-6">
            Select a new role for {selectedCount} selected user(s)
          </p>

          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500 mb-6"
          >
            <option value="STP_USER">STP User</option>
            <option value="STP_ADMIN">STP Admin</option>
            <option value="MSP_USER">MSP User</option>
            <option value="MSP_ADMIN">MSP Admin</option>
          </select>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm(newRole)}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2"
            >
              <Shield className="w-5 h-5" />
              Change Role
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UsersList;