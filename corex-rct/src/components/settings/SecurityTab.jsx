import React, { useState } from 'react';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import { authAPI } from '../../services/api';
import { tokenStorage } from '../../services/api/tokenStorage';
import { Field, FormFooter, SaveButton, SettingsCard, inputCls, useSaveState } from './settingsUi';

const EMPTY = { old_password: '', new_password: '', confirm_password: '' };

const SecurityTab = () => {
  const [form, setForm] = useState(EMPTY);
  const [show, setShow] = useState(false);
  const { saving, saved, error, setError, run } = useSaveState();

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));
  const tooShort = form.new_password.length > 0 && form.new_password.length < 8;
  const mismatch = form.confirm_password.length > 0 && form.new_password !== form.confirm_password;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.new_password.length < 8) return setError('New password must be at least 8 characters.');
    if (form.new_password !== form.confirm_password) return setError('New passwords do not match.');
    if (form.new_password === form.old_password) return setError('New password must be different from the current one.');
    const ok = await run(async () => {
      const { data } = await authAPI.changePassword(form.old_password, form.new_password, form.confirm_password);
      // Other devices were signed out; keep this one signed in with the fresh tokens.
      if (data?.access) tokenStorage.setTokens(data.access, data.refresh);
      return data;
    }, 'Failed to change password');
    if (ok !== undefined) setForm(EMPTY);
  };

  const type = show ? 'text' : 'password';

  return (
    <SettingsCard
      title="Change password"
      description="At least 8 characters, not a common password, not just numbers. Other devices will be signed out; you'll stay signed in here."
      actions={
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          {show ? 'Hide' : 'Show'} passwords
        </button>
      }
    >
      <form onSubmit={handleSubmit} className="max-w-md space-y-4">
        <Field label="Current password" htmlFor="s-old">
          <input id="s-old" type={type} autoComplete="current-password" className={inputCls} value={form.old_password} onChange={set('old_password')} required />
        </Field>
        <Field label="New password" htmlFor="s-new" hint={tooShort ? 'At least 8 characters.' : undefined}>
          <input id="s-new" type={type} autoComplete="new-password" className={inputCls} value={form.new_password} onChange={set('new_password')} required minLength={8} />
        </Field>
        <Field label="Confirm new password" htmlFor="s-confirm" hint={mismatch ? "Doesn't match the new password." : undefined}>
          <input id="s-confirm" type={type} autoComplete="new-password" className={inputCls} value={form.confirm_password} onChange={set('confirm_password')} required />
        </Field>
        <FormFooter error={error}>
          <SaveButton saving={saving} saved={saved} label="Change password" />
        </FormFooter>
        {saved && (
          <p className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
            <KeyRound className="w-4 h-4" /> Password changed.
          </p>
        )}
      </form>
    </SettingsCard>
  );
};

export default SecurityTab;
