import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import Modal from './common/Modal';

const inputCls = "w-full px-3 py-2.5 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500";

const Field = ({ label, required, children }) => (
  <div>
    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">{label}{required && ' *'}</label>
    {children}
  </div>
);

export const AddUserModal = ({ isOpen, onClose, onSuccess, organizations = [], currentOrgId }) => {
  const [form, setForm] = useState({ username: '', email: '', first_name: '', last_name: '', password: '', role: 'STP_USER', organization_id: currentOrgId || '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) { setForm({ username: '', email: '', first_name: '', last_name: '', password: '', role: 'STP_USER', organization_id: currentOrgId || '' }); setError(''); }
  }, [isOpen, currentOrgId]);

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const { userAPI } = await import('../services/api');
      await userAPI.createUser(form);
      onSuccess(); onClose();
    } catch (err) {
      setError(err.response?.data?.email?.[0] || err.response?.data?.username?.[0] || err.response?.data?.error || 'Failed to create user');
    } finally { setLoading(false); }
  };

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add New User" wide>
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-600 dark:text-red-400 text-sm">{error}</div>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Username" required><input type="text" value={form.username} onChange={set('username')} required placeholder="john_doe" className={inputCls} /></Field>
          <Field label="Email" required><input type="email" value={form.email} onChange={set('email')} required placeholder="john@example.com" className={inputCls} /></Field>
          <Field label="First Name" required><input type="text" value={form.first_name} onChange={set('first_name')} required placeholder="John" className={inputCls} /></Field>
          <Field label="Last Name" required><input type="text" value={form.last_name} onChange={set('last_name')} required placeholder="Doe" className={inputCls} /></Field>
          <Field label="Password" required><input type="password" value={form.password} onChange={set('password')} required placeholder="••••••••" minLength={8} className={inputCls} /></Field>
          <Field label="Role" required>
            <select value={form.role} onChange={set('role')} className={inputCls}>
              <option value="STP_USER">STP User</option>
              <option value="STP_ADMIN">STP Admin</option>
              <option value="MSP_USER">MSP User</option>
              <option value="MSP_ADMIN">MSP Admin</option>
              <option value="EMPLOYEE">Employee</option>
            </select>
          </Field>
          {organizations.length > 0 && (
            <div className="md:col-span-2">
              <Field label="Organization" required>
                <select value={form.organization_id} onChange={set('organization_id')} required className={inputCls}>
                  <option value="">Select Organization</option>
                  {organizations.map(o => <option key={o.id} value={o.id}>{o.name} ({o.tenant_type})</option>)}
                </select>
              </Field>
            </div>
          )}
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white text-sm font-medium rounded-lg transition-all">Cancel</button>
          <button type="submit" disabled={loading} className="flex-1 px-4 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white text-sm font-semibold rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Creating...</> : 'Create User'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export const EditUserModal = ({ isOpen, onClose, onSuccess, user, organizations = [] }) => {
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', role: '', organization_id: '', is_active: true });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      setForm({ first_name: user.first_name || '', last_name: user.last_name || '', email: user.email || '', role: user.role || '', organization_id: user.organization?.id || user.organization_id || '', is_active: user.is_active !== undefined ? user.is_active : true });
      setError('');
    }
  }, [user]);

  if (!isOpen || !user) return null;

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const { userAPI } = await import('../services/api');
      await userAPI.updateUser(user.id, form);
      onSuccess(); onClose();
    } catch (err) { setError(err.response?.data?.error || 'Failed to update user'); }
    finally { setLoading(false); }
  };

  const set = (k) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm(f => ({ ...f, [k]: v }));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit User" wide>
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-600 dark:text-red-400 text-sm">{error}</div>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="First Name" required><input type="text" value={form.first_name} onChange={set('first_name')} required className={inputCls} /></Field>
          <Field label="Last Name" required><input type="text" value={form.last_name} onChange={set('last_name')} required className={inputCls} /></Field>
          <Field label="Email" required><input type="email" value={form.email} onChange={set('email')} required className={inputCls} /></Field>
          <Field label="Role" required>
            <select value={form.role} onChange={set('role')} className={inputCls}>
              <option value="STP_USER">STP User</option>
              <option value="STP_ADMIN">STP Admin</option>
              <option value="MSP_USER">MSP User</option>
              <option value="MSP_ADMIN">MSP Admin</option>
              <option value="EMPLOYEE">Employee</option>
            </select>
          </Field>
          {organizations.length > 0 && (
            <div className="md:col-span-2">
              <Field label="Organization">
                <select value={form.organization_id} onChange={set('organization_id')} className={inputCls}>
                  <option value="">No Organization</option>
                  {organizations.map(o => <option key={o.id} value={o.id}>{o.name} ({o.tenant_type})</option>)}
                </select>
              </Field>
            </div>
          )}
          <div className="md:col-span-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={form.is_active} onChange={set('is_active')} className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 text-green-500 focus:ring-2 focus:ring-green-500" />
              <span className="text-sm text-slate-600 dark:text-slate-300">Active User</span>
            </label>
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white text-sm font-medium rounded-lg transition-all">Cancel</button>
          <button type="submit" disabled={loading} className="flex-1 px-4 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-sm font-semibold rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Updating...</> : 'Update User'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export const DeleteUserModal = ({ isOpen, onClose, onConfirm, user, loading }) => {
  if (!isOpen || !user) return null;
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete User">
      <div className="p-5">
        <p className="text-slate-600 dark:text-slate-300 text-sm mb-1">Delete <strong className="text-slate-900 dark:text-white">{user.first_name} {user.last_name}</strong>?</p>
        <p className="text-xs text-slate-500 dark:text-slate-500 mb-5">This action cannot be undone.</p>
        <div className="flex gap-3">
          <button onClick={onClose} disabled={loading} className="flex-1 px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white text-sm font-medium rounded-lg disabled:opacity-50">Cancel</button>
          <button onClick={onConfirm} disabled={loading} className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-lg disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Deleting...</> : 'Delete User'}
          </button>
        </div>
      </div>
    </Modal>
  );
};