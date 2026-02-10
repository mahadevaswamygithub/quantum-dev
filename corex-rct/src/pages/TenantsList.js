import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import { tenantAPI, userAPI } from '../services/api';
import { Building2, Search, Filter, Plus, ArrowRight, Edit, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { AddTenantModal, EditTenantModal, DeleteTenantModal } from '../components/TenantModals';

const TenantsList = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [tenants, setTenants] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('ALL');

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const isGreenAdmin = user.role === 'GREEN_ADMIN';
  const isMSP = user.role === 'MSP_ADMIN' || user.role === 'MSP_USER';
  const basePath = isGreenAdmin ? '/green-admin' : '/msp';

  const fetchData = useCallback(async () => {
    try {
      const [tenantsResponse, usersResponse] = await Promise.all([
        tenantAPI.getTenants(),
        userAPI.getUsers(),
      ]);
      setTenants(tenantsResponse.data || []);
      setAllUsers(usersResponse.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredTenants = tenants.filter((tenant) => {
    const matchesSearch = tenant.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterType === 'ALL' || tenant.tenant_type === filterType;
    return matchesSearch && matchesFilter;
  });

  const handleEdit = (tenant) => {
    setSelectedTenant(tenant);
    setShowEditModal(true);
  };

  const handleDelete = (tenant) => {
    setSelectedTenant(tenant);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!selectedTenant) return;
    
    setDeleteLoading(true);
    try {
      await tenantAPI.deleteTenant(selectedTenant.id);
      await fetchData();
      setShowDeleteModal(false);
      setSelectedTenant(null);
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to delete organization');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleToggleStatus = async (tenantId, e) => {
    e.stopPropagation();
    try {
      await tenantAPI.toggleTenantStatus(tenantId);
      await fetchData();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to toggle organization status');
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

  return (
    <div className="min-h-screen bg-slate-900">
      <Navbar />
      
      <div className="flex">
        <Sidebar 
          userRole={user.role} 
          tenants={tenants}
          users={allUsers}
          onAddTenant={() => setShowAddModal(true)}
        />
        
        <div className="flex-1 p-8">
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-3xl font-bold text-white mb-2">
                  {isGreenAdmin ? 'All Organizations' : 'Tenant Organizations'}
                </h1>
                <p className="text-slate-400">
                  Manage {isGreenAdmin ? 'all' : 'your'} organizations and their users
                </p>
              </div>
              {(isMSP || isGreenAdmin) && (
                <button 
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-semibold rounded-lg transition-all"
                >
                  <Plus className="w-5 h-5" />
                  Add Organization
                </button>
              )}
            </div>
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
                  placeholder="Search organizations..."
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

          {/* Tenants Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTenants.map((tenant) => (
              <div
                key={tenant.id}
                className="bg-slate-800 border border-slate-700 rounded-xl p-6 hover:border-green-500/50 transition-all group relative"
              >
                {/* Action Buttons */}
                <div className="absolute top-4 right-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => handleToggleStatus(tenant.id, e)}
                    className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                    title={tenant.is_active ? 'Deactivate' : 'Activate'}
                  >
                    {tenant.is_active ? (
                      <ToggleRight className="w-4 h-4 text-green-400" />
                    ) : (
                      <ToggleLeft className="w-4 h-4 text-slate-400" />
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(tenant);
                    }}
                    className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit className="w-4 h-4 text-blue-400" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(tenant);
                    }}
                    className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>

                {/* Card Content */}
                <div
                  className="cursor-pointer"
                  onClick={() => navigate(`${basePath}/tenants/${tenant.id}`)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                      tenant.tenant_type === 'MSP'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-purple-500/20 text-purple-400'
                    }`}>
                      <Building2 className="w-6 h-6" />
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-600 group-hover:text-green-400 transition-colors" />
                  </div>
                  
                  <h3 className="text-lg font-bold text-white mb-2 group-hover:text-green-400 transition-colors">
                    {tenant.name}
                  </h3>
                  
                  <div className="flex items-center gap-2 mb-4">
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
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Users:</span>
                      <span className="text-white font-medium">{tenant.user_count || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Schema:</span>
                      <span className="text-white font-mono text-xs">{tenant.schema_name}</span>
                    </div>
                    {tenant.parent_name && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Parent:</span>
                        <span className="text-white text-xs">{tenant.parent_name}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredTenants.length === 0 && (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-12 text-center">
              <Building2 className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">No organizations found</h3>
              <p className="text-slate-400 mb-6">
                {searchTerm || filterType !== 'ALL'
                  ? 'Try adjusting your search or filters'
                  : 'Get started by creating your first organization'}
              </p>
              {(isMSP || isGreenAdmin) && (
                <button 
                  onClick={() => setShowAddModal(true)}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-semibold rounded-lg transition-all"
                >
                  <Plus className="w-5 h-5" />
                  Add Organization
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <AddTenantModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={fetchData}
        parentOrgId={isMSP ? user.organization_id : null}
      />

      <EditTenantModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedTenant(null);
        }}
        onSuccess={fetchData}
        tenant={selectedTenant}
      />

      <DeleteTenantModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedTenant(null);
        }}
        onConfirm={confirmDelete}
        tenant={selectedTenant}
        loading={deleteLoading}
      />
    </div>
  );
};

export default TenantsList;