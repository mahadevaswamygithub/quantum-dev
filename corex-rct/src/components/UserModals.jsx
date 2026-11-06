import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import Modal from './common/Modal';
import Tooltip from './common/Tooltip';
import { userAPI } from '../services/api';
import { usePermissions } from '../hooks/usePermissions';

const inputCls = "w-full px-3 py-2.5 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500";

const Field = ({ label, required, tooltip, children }) => (
  <div>
    <div className="flex items-center gap-1.5 mb-1.5">
      <label className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}{required && ' *'}</label>
      {tooltip && <Tooltip content={tooltip} />}
    </div>
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
    { value: 'MSP_USER', label: 'MSP staff — choose what they can access' },
    { value: 'MSP_ADMIN', label: 'MSP admin — full access' },
  ],
  STP: [
    { value: 'STP_USER', label: 'Staff — choose what they can access' },
    { value: 'STP_ADMIN', label: 'Admin — full access' },
    { value: 'EMPLOYEE', label: 'Employee (employee portal only)' },
  ],
};

/** The org type a given role can target — MSP_* roles only make sense in an
 * MSP org, everything else (STP_*, EMPLOYEE) only in an STP org. Mirrors
 * the backend's _check_role_matches_org_type (apps/users/serializers/users.py). */
const roleOrgType = (role) => (role && role.startsWith('MSP_')) ? 'MSP' : 'STP';

/** Which roles this modal offers at all, based on who's opening it — an MSP
 * admin manages both their own MSP teammates and their STP sub-orgs' staff,
 * an STP admin only ever manages their own STP-side roles. */
const ADMIN_TIERS = ['MSP_ADMIN', 'STP_ADMIN'];
const STAFF_TIERS = ['MSP_USER', 'STP_USER'];

/** Only admins may create/promote admins (the API enforces this too); a
 * non-admin editing someone keeps that person's current option visible. */
const roleOptionsFor = (currentOrgType, isAdmin = true, keep = null) => {
  const all = currentOrgType === 'MSP' ? [...ROLE_OPTIONS.MSP, ...ROLE_OPTIONS.STP] : ROLE_OPTIONS.STP;
  return isAdmin ? all : all.filter(r => !ADMIN_TIERS.includes(r.value) || r.value === keep);
};

/** Picks one of the target organization's custom roles (Front desk, Cashier...). */
const AccessRoleField = ({ organizationId, value, onChange }) => {
  const [roles, setRoles] = useState(null);
  useEffect(() => {
    if (!organizationId) { setRoles([]); return undefined; }
    let cancelled = false;
    userAPI.getRoles({ organization: organizationId })
      .then(({ data }) => {
        if (cancelled) return;
        const list = data || [];
        setRoles(list);
        if (!list.some(r => String(r.id) === String(value)) && list.length) {
          const preferred = list.find(r => r.name === 'Manager' || r.name === 'Account manager') || list[0];
          onChange(String(preferred.id));
        }
      })
      .catch(() => { if (!cancelled) setRoles([]); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  const selected = roles?.find(r => String(r.id) === String(value));
  return (
    <Field label="Access role" required tooltip="What this person can see and do. Edit roles in Settings → Roles & access.">
      <select value={value || ''} onChange={e => onChange(e.target.value)} required className={inputCls} disabled={!roles}>
        {!roles && <option value="">Loading roles…</option>}
        {roles && roles.length === 0 && <option value="">No roles — create one in Settings → Roles & access</option>}
        {roles?.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
      </select>
      {selected?.description && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{selected.description}</p>}
    </Field>
  );
};

const errorFrom = (err, fallback) => {
  const d = err.response?.data || {};
  return d.role?.[0] || d.access_role_id?.[0] || d.email?.[0] || d.username?.[0] || d.organization_id?.[0] || d.error || d.detail || fallback;
};

export const AddUserModal = ({ isOpen, onClose, onSuccess, organizations = [], currentOrgId, currentOrgType = 'STP' }) => {
  const { isAdmin } = usePermissions();
  const emptyForm = () => {
    const roleOptions = roleOptionsFor(currentOrgType, isAdmin);
    return { username: '', email: '', first_name: '', last_name: '', role: roleOptions[0].value, organization_id: currentOrgId || '', access_role_id: '' };
  };
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) { setForm(emptyForm()); setError(''); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, currentOrgId, currentOrgType]);

  const roleOptions = roleOptionsFor(currentOrgType, isAdmin);
  // Organization choices are scoped to whatever org type the *selected role*
  // implies (not the other way around) — an MSP role can only ever target
  // an MSP organization, so an STP sub-org never even shows up as a pickable
  // option once "MSP Admin"/"MSP User" is the selected role.
  const orgOptions = organizations.filter(o => o.tenant_type === roleOrgType(form.role));

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const payload = { ...form, access_role_id: STAFF_TIERS.includes(form.role) ? (form.access_role_id || null) : null };
      await userAPI.createUser(payload);
      onSuccess(); onClose();
    } catch (err) {
      setError(errorFrom(err, 'Failed to invite user'));
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Username" required><input type="text" value={form.username} onChange={set('username')} required placeholder="john_doe" className={inputCls} /></Field>
          <Field label="Email" required tooltip="They'll receive an email with a link to set their own password."><input type="email" value={form.email} onChange={set('email')} required placeholder="john@example.com" className={inputCls} /></Field>
          <Field label="First Name" required><input type="text" value={form.first_name} onChange={set('first_name')} required placeholder="John" className={inputCls} /></Field>
          <Field label="Last Name" required><input type="text" value={form.last_name} onChange={set('last_name')} required placeholder="Doe" className={inputCls} /></Field>
          <Field label="Type of user" required tooltip="Admins have full access. Staff get an access role that decides what they can see and do.">
            <select value={form.role} onChange={handleRoleChange} className={inputCls}>
              {roleOptions.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </Field>
          {STAFF_TIERS.includes(form.role) && (
            <AccessRoleField organizationId={form.organization_id || currentOrgId} value={form.access_role_id}
              onChange={v => setForm(f => ({ ...f, access_role_id: v }))} />
          )}
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
  const { isAdmin } = usePermissions();
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', role: '', organization_id: '', is_active: true, access_role_id: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      setForm({ first_name: user.first_name || '', last_name: user.last_name || '', email: user.email || '', role: user.role || '', organization_id: user.organization?.id || user.organization_id || '', is_active: user.is_active !== undefined ? user.is_active : true, access_role_id: user.access_role?.id ? String(user.access_role.id) : '' });
      setError('');
    }
  }, [user]);

  if (!isOpen || !user) return null;

  const roleOptions = roleOptionsFor(currentOrgType, isAdmin, user?.role);
  const orgOptions = organizations.filter(o => o.tenant_type === roleOrgType(form.role));

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const payload = { ...form, access_role_id: STAFF_TIERS.includes(form.role) ? (form.access_role_id || null) : null };
      await userAPI.updateUser(user.id, payload);
      onSuccess(); onClose();
    } catch (err) { setError(errorFrom(err, 'Failed to update user')); }
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
          <Field label="Type of user" required>
            <select value={form.role} onChange={handleRoleChange} className={inputCls}>
              {roleOptions.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </Field>
          {STAFF_TIERS.includes(form.role) && (
            <AccessRoleField organizationId={form.organization_id} value={form.access_role_id}
              onChange={v => setForm(f => ({ ...f, access_role_id: v }))} />
          )}
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