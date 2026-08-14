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

// Which roles make sense depends on the target org's type — an MSP role in
// an STP organization (or vice versa) isn't just wrong labeling, MSP routes
// are gated by role alone (not re-checked against the org), so it's a real
// privilege mismatch. The backend enforces this too (UserCreateSerializer /
// UserUpdateSerializer) — this is the UX half, so the mismatch is never
// even offered as an option.
export const ROLE_OPTIONS = {
  MSP: [
    { value: 'MSP_USER', label: 'MSP User' },
    { value: 'MSP_ADMIN', label: 'MSP Admin' },
  ],
  STP: [
    { value: 'STP_USER', label: 'STP User' },
    { value: 'STP_ADMIN', label: 'STP Admin' },
    { value: 'EMPLOYEE', label: 'Employee' },
  ],
};

/** The org type a given role can target — MSP_* roles only make sense in an
 * MSP org, everything else (STP_*, EMPLOYEE) only in an STP org. Mirrors
 * the backend's _check_role_matches_org_type (apps/users/serializers/users.py). */
const roleOrgType = (role) => (role && role.startsWith('MSP_')) ? 'MSP' : 'STP';

/** Which roles this modal offers at all, based on who's opening it — an MSP
 * admin manages both their own MSP teammates and their STP sub-orgs' staff,
 * an STP admin only ever manages their own STP-side roles. */
const roleOptionsFor = (currentOrgType) =>
  currentOrgType === 'MSP' ? [...ROLE_OPTIONS.MSP, ...ROLE_OPTIONS.STP] : ROLE_OPTIONS.STP;

export const AddUserModal = ({ isOpen, onClose, onSuccess, organizations = [], currentOrgId, currentOrgType = 'STP' }) => {
  const emptyForm = () => {
    const roleOptions = roleOptionsFor(currentOrgType);
    return { username: '', email: '', first_name: '', last_name: '', role: roleOptions[0].value, organization_id: currentOrgId || '' };
  };
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) { setForm(emptyForm()); setError(''); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, currentOrgId, currentOrgType]);

  const roleOptions = roleOptionsFor(currentOrgType);
  // Organization choices are scoped to whatever org type the *selected role*
  // implies (not the other way around) — an MSP role can only ever target
  // an MSP organization, so an STP sub-org never even shows up as a pickable
  // option once "MSP Admin"/"MSP User" is the selected role.
  const orgOptions = organizations.filter(o => o.tenant_type === roleOrgType(form.role));

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const { userAPI } = await import('../services/api');
      await userAPI.createUser(form);
      onSuccess(); onClose();
    } catch (err) {
      setError(err.response?.data?.role?.[0] || err.response?.data?.email?.[0] || err.response?.data?.username?.[0] || err.response?.data?.error || 'Failed to invite user');
    } finally { setLoading(false); }
  };

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleRoleChange = (e) => {
    const newRole = e.target.value;
    const newOrgType = roleOrgType(newRole);
    setForm(f => {
      const currentOrgStillValid = organizations.some(o => String(o.id) === String(f.organization_id) && o.tenant_type === newOrgType);
      return {
        ...f,
        role: newRole,
        organization_id: currentOrgStillValid
          ? f.organization_id
          : (organizations.find(o => o.tenant_type === newOrgType)?.id ?? ''),
      };
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Invite User" wide>
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-600 dark:text-red-400 text-sm">{error}</div>}
        <p className="text-xs text-slate-500 dark:text-slate-500 -mt-1">They'll get an email with a link to set their own password.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Username" required><input type="text" value={form.username} onChange={set('username')} required placeholder="john_doe" className={inputCls} /></Field>
          <Field label="Email" required><input type="email" value={form.email} onChange={set('email')} required placeholder="john@example.com" className={inputCls} /></Field>
          <Field label="First Name" required><input type="text" value={form.first_name} onChange={set('first_name')} required placeholder="John" className={inputCls} /></Field>
          <Field label="Last Name" required><input type="text" value={form.last_name} onChange={set('last_name')} required placeholder="Doe" className={inputCls} /></Field>
          <Field label="Role" required>
            <select value={form.role} onChange={handleRoleChange} className={inputCls}>
              {roleOptions.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </Field>
          {organizations.length > 0 && (
            <div className="md:col-span-2">
              <Field label="Organization" required>
                <select value={form.organization_id} onChange={set('organization_id')} required className={inputCls}>
                  <option value="">Select Organization</option>
                  {orgOptions.map(o => <option key={o.id} value={o.id}>{o.name} ({o.tenant_type})</option>)}
                </select>
              </Field>
            </div>
          )}
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white text-sm font-medium rounded-lg transition-all">Cancel</button>
          <button type="submit" disabled={loading} className="flex-1 px-4 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white text-sm font-semibold rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Sending invite...</> : 'Send Invite'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export const EditUserModal = ({ isOpen, onClose, onSuccess, user, organizations = [], currentOrgType = 'STP' }) => {
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

  const roleOptions = roleOptionsFor(currentOrgType);
  const orgOptions = organizations.filter(o => o.tenant_type === roleOrgType(form.role));

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const { userAPI } = await import('../services/api');
      await userAPI.updateUser(user.id, form);
      onSuccess(); onClose();
    } catch (err) { setError(err.response?.data?.role?.[0] || err.response?.data?.error || 'Failed to update user'); }
    finally { setLoading(false); }
  };

  const set = (k) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm(f => ({ ...f, [k]: v }));
  };

  const handleRoleChange = (e) => {
    const newRole = e.target.value;
    const newOrgType = roleOrgType(newRole);
    setForm(f => {
      const currentOrgStillValid = organizations.some(o => String(o.id) === String(f.organization_id) && o.tenant_type === newOrgType);
      return {
        ...f,
        role: newRole,
        organization_id: currentOrgStillValid
          ? f.organization_id
          : (organizations.find(o => o.tenant_type === newOrgType)?.id ?? ''),
      };
    });
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
            <select value={form.role} onChange={handleRoleChange} className={inputCls}>
              {roleOptions.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </Field>
          {organizations.length > 0 && (
            <div className="md:col-span-2">
              <Field label="Organization">
                <select value={form.organization_id} onChange={set('organization_id')} className={inputCls}>
                  <option value="">No Organization</option>
                  {orgOptions.map(o => <option key={o.id} value={o.id}>{o.name} ({o.tenant_type})</option>)}
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