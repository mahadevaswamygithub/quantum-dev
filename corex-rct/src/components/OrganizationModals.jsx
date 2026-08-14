import React, { useState, useEffect, useRef } from 'react';
import { Loader2, Camera, Building2 } from 'lucide-react';
import { tenantAPI } from '../services/api';
import Modal from './common/Modal';
import { ORG_TYPES } from '../constants/orgTypes';
import LocationField from './LocationField';
import Avatar from './common/Avatar';

const emptyOrgForm = (parentOrgId) => ({
  name: '', tenant_type: 'STP', org_type: '', parent_organization_id: parentOrgId || null,
  latitude: '', longitude: '',
  admin_first_name: '', admin_last_name: '', admin_email: '',
});

export const AddOrganizationModal = ({ isOpen, onClose, onSuccess, parentOrgId }) => {
  const [form, setForm] = useState(emptyOrgForm(parentOrgId));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) setForm(emptyOrgForm(parentOrgId));
  }, [isOpen, parentOrgId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = { ...form };
      if (parentOrgId) { data.parent_organization_id = parentOrgId; data.tenant_type = 'STP'; }
      if (data.tenant_type === 'MSP') data.org_type = null;
      data.latitude = data.latitude === '' ? null : data.latitude;
      data.longitude = data.longitude === '' ? null : data.longitude;
      await tenantAPI.createTenant(data);
      onSuccess();
      onClose();
    } catch (err) {
      setError(
        err.response?.data?.name?.[0] ||
        err.response?.data?.org_type?.[0] ||
        err.response?.data?.latitude?.[0] ||
        err.response?.data?.longitude?.[0] ||
        err.response?.data?.admin_email?.[0] ||
        err.response?.data?.error ||
        'Failed to create organization'
      );
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
        {!parentOrgId && (
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Organization Type *</label>
            <select value={form.tenant_type} onChange={e => setForm(f => ({ ...f, tenant_type: e.target.value, org_type: e.target.value === 'MSP' ? '' : f.org_type }))}
              className="w-full px-3 py-2.5 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
              <option value="STP">Single Tenant Portal (STP)</option>
              <option value="MSP">Multi-Service Provider (MSP)</option>
            </select>
          </div>
        )}
        {form.tenant_type === 'STP' && (
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Business Type *</label>
            <select value={form.org_type} onChange={e => setForm(f => ({ ...f, org_type: e.target.value }))} required
              className="w-full px-3 py-2.5 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
              <option value="" disabled>Select a business type…</option>
              {ORG_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">Determines what this organization's portal looks like.</p>
          </div>
        )}

        <LocationField
          latitude={form.latitude}
          longitude={form.longitude}
          onResolved={(lat, lng) => setForm(f => ({ ...f, latitude: lat, longitude: lng }))}
          onClear={() => setForm(f => ({ ...f, latitude: '', longitude: '' }))}
        />

        <div className="pt-1 border-t border-slate-200 dark:border-slate-700">
          <p className="pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Admin User</p>
          <p className="text-xs text-slate-500 dark:text-slate-500 mb-3">A login will be created for this organization and emailed to the address below.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Admin First Name *</label>
            <input type="text" value={form.admin_first_name} onChange={e => setForm(f => ({ ...f, admin_first_name: e.target.value }))} required
              className="w-full px-3 py-2.5 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Jane" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Admin Last Name *</label>
            <input type="text" value={form.admin_last_name} onChange={e => setForm(f => ({ ...f, admin_last_name: e.target.value }))} required
              className="w-full px-3 py-2.5 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Doe" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Admin Email *</label>
          <input type="email" value={form.admin_email} onChange={e => setForm(f => ({ ...f, admin_email: e.target.value }))} required
            className="w-full px-3 py-2.5 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="admin@acme.com" />
        </div>

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
  const [form, setForm] = useState({ name: '', is_active: true, org_type: '', latitude: '', longitude: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [logo, setLogo] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef(null);

  useEffect(() => {
    if (organization) {
      setForm({
        name: organization.name || '',
        is_active: organization.is_active !== undefined ? organization.is_active : true,
        org_type: organization.org_type || '',
        latitude: organization.latitude ?? '',
        longitude: organization.longitude ?? '',
      });
      setLogo(organization.logo || null);
    }
  }, [organization]);

  if (!isOpen || !organization) return null;

  // Uploads immediately (like the profile-picture camera button elsewhere)
  // rather than waiting on the form's Save — a logo isn't a form field the
  // update endpoint accepts, it's its own multipart upload_logo action.
  const handleLogoChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingLogo(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await tenantAPI.uploadLogo(organization.id, fd);
      setLogo(data.logo);
      onSuccess();
    } catch { alert('Failed to upload logo'); }
    finally { setUploadingLogo(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = { ...form };
      data.latitude = data.latitude === '' ? null : data.latitude;
      data.longitude = data.longitude === '' ? null : data.longitude;
      await tenantAPI.updateTenant(organization.id, data);
      onSuccess();
      onClose();
    } catch (err) {
      setError(
        err.response?.data?.org_type?.[0] ||
        err.response?.data?.latitude?.[0] ||
        err.response?.data?.longitude?.[0] ||
        err.response?.data?.error ||
        'Failed to update'
      );
    } finally { setLoading(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Organization">
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-600 dark:text-red-400 text-sm">{error}</div>}

        <div className="flex items-center gap-3">
          <Avatar src={logo} icon={Building2} className="w-14 h-14 rounded-xl" bg="bg-slate-100 dark:bg-slate-700" textClass="text-slate-400" />
          <div>
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              disabled={uploadingLogo}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 text-xs font-medium rounded-lg transition-all disabled:opacity-50"
            >
              <Camera className="w-3.5 h-3.5" /> {uploadingLogo ? 'Uploading...' : logo ? 'Change Logo' : 'Upload Logo'}
            </button>
            <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Organization Name</label>
          <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required
            className="w-full px-3 py-2.5 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>
        {organization.tenant_type === 'STP' && (
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Business Type</label>
            <select value={form.org_type} onChange={e => setForm(f => ({ ...f, org_type: e.target.value }))}
              className="w-full px-3 py-2.5 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
              <option value="" disabled>Select a business type…</option>
              {ORG_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        )}
        <LocationField
          latitude={form.latitude}
          longitude={form.longitude}
          onResolved={(lat, lng) => setForm(f => ({ ...f, latitude: lat, longitude: lng }))}
          onClear={() => setForm(f => ({ ...f, latitude: '', longitude: '' }))}
        />
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