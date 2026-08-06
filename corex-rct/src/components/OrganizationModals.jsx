import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { tenantAPI } from '../services/api';
import Modal from './common/Modal';

export const AddOrganizationModal = ({ isOpen, onClose, onSuccess, parentOrgId }) => {
  const [form, setForm] = useState({ name: '', domain_name: '', tenant_type: 'STP', parent_organization_id: parentOrgId || null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) setForm({ name: '', domain_name: '', tenant_type: 'STP', parent_organization_id: parentOrgId || null });
  }, [isOpen, parentOrgId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = { ...form };
      if (parentOrgId) { data.parent_organization_id = parentOrgId; data.tenant_type = 'STP'; }
      await tenantAPI.createTenant(data);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.name?.[0] || err.response?.data?.domain_name?.[0] || err.response?.data?.error || 'Failed to create organization');
    } finally { setLoading(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={parentOrgId ? 'Add Sub-Organization' : 'Add Organization'}>
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-600 dark:text-red-400 text-sm">{error}</div>}
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Organization Name *</label>
          <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required
            className="w-full px-3 py-2.5 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="Acme Corporation" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Domain Name *</label>
          <input type="text" value={form.domain_name} onChange={e => setForm(f => ({ ...f, domain_name: e.target.value }))} required
            className="w-full px-3 py-2.5 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="acme.corex.local" />
          <p className="mt-1 text-xs text-slate-500">Used as subdomain for the organization</p>
        </div>
        {!parentOrgId && (
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Organization Type *</label>
            <select value={form.tenant_type} onChange={e => setForm(f => ({ ...f, tenant_type: e.target.value }))}
              className="w-full px-3 py-2.5 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
              <option value="STP">Single Tenant Portal (STP)</option>
              <option value="MSP">Multi-Service Provider (MSP)</option>
            </select>
          </div>
        )}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white text-sm font-medium rounded-lg transition-all">Cancel</button>
          <button type="submit" disabled={loading} className="flex-1 px-4 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white text-sm font-semibold rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Creating...</> : 'Create Organization'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export const EditOrganizationModal = ({ isOpen, onClose, onSuccess, organization }) => {
  const [form, setForm] = useState({ name: '', is_active: true });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (organization) setForm({ name: organization.name || '', is_active: organization.is_active !== undefined ? organization.is_active : true });
  }, [organization]);

  if (!isOpen || !organization) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await tenantAPI.updateTenant(organization.id, form);
      onSuccess();
      onClose();
    } catch (err) { setError(err.response?.data?.error || 'Failed to update'); }
    finally { setLoading(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Organization">
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-600 dark:text-red-400 text-sm">{error}</div>}
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Organization Name</label>
          <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required
            className="w-full px-3 py-2.5 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
            className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 text-green-500 focus:ring-2 focus:ring-green-500" />
          <span className="text-sm text-slate-600 dark:text-slate-300">Active Organization</span>
        </label>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white text-sm font-medium rounded-lg transition-all">Cancel</button>
          <button type="submit" disabled={loading} className="flex-1 px-4 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-sm font-semibold rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Updating...</> : 'Update'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export const DeleteOrganizationModal = ({ isOpen, onClose, onConfirm, organization, loading }) => {
  if (!isOpen || !organization) return null;
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Organization">
      <div className="p-5">
        <p className="text-slate-600 dark:text-slate-300 text-sm mb-1">Are you sure you want to delete <strong className="text-slate-900 dark:text-white">{organization.name}</strong>?</p>
        <p className="text-xs text-slate-500 dark:text-slate-500 mb-5">This action cannot be undone. All associated data will be permanently deleted.</p>
        <div className="flex gap-3">
          <button onClick={onClose} disabled={loading} className="flex-1 px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white text-sm font-medium rounded-lg transition-all disabled:opacity-50">Cancel</button>
          <button onClick={onConfirm} disabled={loading} className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Deleting...</> : 'Delete'}
          </button>
        </div>
      </div>
    </Modal>
  );
};