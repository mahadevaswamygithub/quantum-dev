import React, { useState } from 'react';
import { X, Loader2, Building2 } from 'lucide-react';
import { tenantAPI } from '../services/api';

// Add Tenant Modal
export const AddTenantModal = ({ isOpen, onClose, onSuccess, parentOrgId }) => {
  const [formData, setFormData] = useState({
    name: '',
    domain_name: '',
    tenant_type: 'STP',
    parent_organization_id: parentOrgId || null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const submitData = { ...formData };
      if (parentOrgId) {
        submitData.parent_organization_id = parentOrgId;
        submitData.tenant_type = 'STP'; // Sub-orgs are always STP
      }
      
      await tenantAPI.createTenant(submitData);
      onSuccess();
      onClose();
      setFormData({ name: '', domain_name: '', tenant_type: 'STP', parent_organization_id: null });
    } catch (err) {
      const errorMsg = err.response?.data?.name?.[0] || 
                      err.response?.data?.domain_name?.[0] ||
                      err.response?.data?.error ||
                      'Failed to create organization';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl shadow-xl max-w-md w-full border border-slate-700">
        <div className="p-6 border-b border-slate-700 flex items-center justify-between">
          <h3 className="text-xl font-bold text-white">
            {parentOrgId ? 'Add Sub-Organization' : 'Add New Organization'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Organization Name *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Acme Corporation"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Domain Name *
            </label>
            <input
              type="text"
              name="domain_name"
              value={formData.domain_name}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="acme.corex.local"
              required
            />
            <p className="mt-1 text-xs text-slate-500">
              This will be used as the subdomain for the organization
            </p>
          </div>

          {!parentOrgId && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Organization Type *
              </label>
              <select
                name="tenant_type"
                value={formData.tenant_type}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                required
              >
                <option value="STP">Single Tenant Portal (STP)</option>
                <option value="MSP">Multi-Service Provider (MSP)</option>
              </select>
              <p className="mt-1 text-xs text-slate-500">
                {formData.tenant_type === 'MSP'
                  ? 'MSP can manage multiple sub-organizations'
                  : 'STP is for individual organizations'}
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Organization'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Edit Tenant Modal
export const EditTenantModal = ({ isOpen, onClose, onSuccess, tenant }) => {
  const [formData, setFormData] = useState({
    name: tenant?.name || '',
    is_active: tenant?.is_active !== undefined ? tenant.is_active : true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !tenant) return null;

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({
      ...formData,
      [e.target.name]: value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await tenantAPI.updateTenant(tenant.id, formData);
      onSuccess();
      onClose();
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to update organization';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl shadow-xl max-w-md w-full border border-slate-700">
        <div className="p-6 border-b border-slate-700 flex items-center justify-between">
          <h3 className="text-xl font-bold text-white">Edit Organization</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Organization Name
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500"
              required
            />
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="is_active"
                checked={formData.is_active}
                onChange={handleChange}
                className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-green-500 focus:ring-2 focus:ring-green-500"
              />
              <span className="text-sm font-medium text-slate-300">Active Organization</span>
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Organization'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Delete Tenant Modal
export const DeleteTenantModal = ({ isOpen, onClose, onConfirm, tenant, loading }) => {
  if (!isOpen || !tenant) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl shadow-xl max-w-md w-full border border-slate-700">
        <div className="p-6">
          <h3 className="text-xl font-bold text-white mb-4">Delete Organization</h3>
          <p className="text-slate-300 mb-2">
            Are you sure you want to delete <strong>{tenant.name}</strong>?
          </p>
          <p className="text-sm text-slate-400 mb-6">
            This action cannot be undone. All data associated with this organization will be permanently deleted.
          </p>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};