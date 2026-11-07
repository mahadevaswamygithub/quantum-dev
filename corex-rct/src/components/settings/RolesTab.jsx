import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Crown, Loader2, Lock, Plus, Trash2, Users as UsersIcon } from 'lucide-react';
import { userAPI } from '../../services/api';
import { usePermissions } from '../../hooks/usePermissions';
import {
  ErrorCard, Field, FormFooter, LoadingCard, SaveButton, SettingsCard, apiErrorMessage, inputCls, useSaveState,
} from './settingsUi';

const blankRole = { id: null, name: '', description: '', permissions: [] };

/**
 * Settings → Roles & access. Each organization's admins define what each
 * staff role can see and do; Admin itself always has full access.
 */
const RolesTab = () => {
  const { isAdmin } = usePermissions();
  const [roles, setRoles] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const { saving, saved, error, setError, run } = useSaveState();

  const load = useCallback(async (selectId) => {
    try {
      const [r, c] = await Promise.all([userAPI.getRoles(), userAPI.getRoleCatalog()]);
      setRoles(r.data || []);
      setCatalog(c.data || []);
      const pick = (r.data || []).find(x => x.id === selectId) || (r.data || [])[0];
      if (pick) { setSelectedId(pick.id); setDraft({ ...pick }); }
    } catch (err) {
      setLoadError(apiErrorMessage(err, 'Could not load roles'));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const selectRole = (role) => { setSelectedId(role.id); setDraft({ ...role }); setError(''); };
  const newRole = () => { setSelectedId('new'); setDraft({ ...blankRole }); setError(''); };

  const toggle = (code) => setDraft(d => ({
    ...d,
    permissions: d.permissions.includes(code) ? d.permissions.filter(p => p !== code) : [...d.permissions, code],
  }));
  const toggleSection = (section, on) => setDraft(d => {
    const codes = section.perms.map(p => p.code);
    const rest = d.permissions.filter(p => !codes.includes(p));
    return { ...d, permissions: on ? [...rest, ...codes] : rest };
  });

  const save = async (e) => {
    e.preventDefault();
    const payload = { name: draft.name, description: draft.description, permissions: draft.permissions };
    const data = await run(async () => (draft.id
      ? await userAPI.updateRole(draft.id, payload)
      : await userAPI.createRole(payload)).data, 'Failed to save role');
    if (data) await load(data.id);
  };

  const remove = async () => {
    if (!draft?.id || !window.confirm(`Delete the “${draft.name}” role?`)) return;
    setDeleting(true);
    setError('');
    try {
      await userAPI.deleteRole(draft.id);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to delete role'));
    } finally {
      setDeleting(false);
    }
  };

  const permCount = useMemo(() => catalog.reduce((n, s) => n + s.perms.length, 0), [catalog]);

  if (loadError) return <ErrorCard message={loadError} />;
  if (!roles) return <LoadingCard />;

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_1fr] items-start">
      {/* Role list */}
      <SettingsCard
        title="Roles"
        actions={isAdmin && (
          <button type="button" onClick={newRole}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold">
            <Plus className="w-4 h-4" /> New role
          </button>
        )}
      >
        <ul className="space-y-1 -mx-2">
          <li className="flex items-start gap-3 px-3 py-2.5 rounded-lg text-slate-500 dark:text-slate-400">
            <Crown className="w-4 h-4 mt-0.5 text-amber-500 flex-shrink-0" />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-slate-900 dark:text-white">Admin</span>
              <span className="block text-xs">Full access, always. Set when adding a user.</span>
            </span>
          </li>
          {roles.map(r => (
            <li key={r.id}>
              <button type="button" onClick={() => selectRole(r)}
                className={`w-full flex items-start justify-between gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                  selectedId === r.id ? 'bg-green-50 dark:bg-green-500/10' : 'hover:bg-slate-100 dark:hover:bg-slate-700/60'
                }`}>
                <span className="min-w-0">
                  <span className={`block text-sm font-medium truncate ${selectedId === r.id ? 'text-green-700 dark:text-green-400' : 'text-slate-900 dark:text-white'}`}>{r.name}</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">{r.permissions.length} of {permCount} permissions</span>
                </span>
                <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 flex-shrink-0" title="Users with this role">
                  <UsersIcon className="w-3.5 h-3.5" />{r.user_count}
                </span>
              </button>
            </li>
          ))}
          {selectedId === 'new' && (
            <li className="px-3 py-2.5 rounded-lg bg-green-50 dark:bg-green-500/10 text-sm font-medium text-green-700 dark:text-green-400">New role</li>
          )}
        </ul>
      </SettingsCard>

      {/* Role editor */}
      {draft && (
        <SettingsCard
          title={draft.id ? draft.name : 'New role'}
          description={isAdmin ? 'Tick what people with this role can see and do. Changes apply the next time they load a page.' : 'Only an organization admin can change roles.'}
        >
          <form onSubmit={save}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Role name" htmlFor="r-name">
                <input id="r-name" className={inputCls} value={draft.name} disabled={!isAdmin} required maxLength={60}
                  onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} placeholder="e.g. Night manager" />
              </Field>
              <Field label="Description" htmlFor="r-desc">
                <input id="r-desc" className={inputCls} value={draft.description} disabled={!isAdmin} maxLength={200}
                  onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} placeholder="What this role is for" />
              </Field>
            </div>

            <div className="mt-6 grid gap-4 xl:grid-cols-2">
              {catalog.map(section => {
                const codes = section.perms.map(p => p.code);
                const all = codes.every(c => draft.permissions.includes(c));
                return (
                  <fieldset key={section.key} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                    <legend className="sr-only">{section.label}</legend>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{section.label}</p>
                      {isAdmin && (
                        <button type="button" onClick={() => toggleSection(section, !all)}
                          className="text-xs font-medium text-green-600 hover:text-green-700 dark:text-green-400">
                          {all ? 'Clear all' : 'Select all'}
                        </button>
                      )}
                    </div>
                    <ul className="space-y-2">
                      {section.perms.map(p => {
                        const on = draft.permissions.includes(p.code);
                        return (
                          <li key={p.code}>
                            <label className={`flex items-center gap-3 text-sm ${isAdmin ? 'cursor-pointer' : ''}`}>
                              <span className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 ${
                                on ? 'bg-green-600 border-green-600 text-white' : 'border-slate-300 dark:border-slate-600'
                              }`}>
                                {on && <Check className="w-3.5 h-3.5" />}
                              </span>
                              <input type="checkbox" className="sr-only" checked={on} disabled={!isAdmin} onChange={() => toggle(p.code)} />
                              <span className="text-slate-700 dark:text-slate-200">{p.label}</span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </fieldset>
                );
              })}
            </div>

            {isAdmin ? (
              <FormFooter error={error}>
                {draft.id && (
                  <button type="button" onClick={remove} disabled={deleting}
                    className="mr-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10 disabled:opacity-50">
                    {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Delete role
                  </button>
                )}
                <SaveButton saving={saving} saved={saved} label={draft.id ? 'Save changes' : 'Create role'} />
              </FormFooter>
            ) : (
              <p className="mt-4 flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400"><Lock className="w-4 h-4" />Read-only</p>
            )}
          </form>
        </SettingsCard>
      )}
    </div>
  );
};

export default RolesTab;
