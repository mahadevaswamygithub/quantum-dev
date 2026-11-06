import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { userAPI } from '../../services/api';
import { SettingsCard, apiErrorMessage, inputCls } from '../settings/settingsUi';

/** Guest self-service account deletion (personal data erased; properties keep their reservation records). */
const DeleteAccountCard = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await userAPI.deleteMyAccount(password);
      logout();
      navigate('/book', { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not delete your account.'));
      setBusy(false);
    }
  };

  return (
    <SettingsCard title="Delete account" description="Permanently remove your account and personal details.">
      {!open ? (
        <button type="button" onClick={() => setOpen(true)}
          className="px-4 py-2 rounded-lg border border-red-300 dark:border-red-500/40 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10">
          Delete my account
        </button>
      ) : (
        <form onSubmit={submit} className="space-y-3 max-w-md">
          <div className="flex gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-sm text-red-800 dark:text-red-200">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <p>Your name, email, phone, photo and login are erased and can’t be recovered.</p>
              <p className="mt-1">Properties you stayed with keep their record of your past bookings, as required for their accounts. Upcoming bookings must be cancelled first.</p>
            </div>
          </div>
          <label className="block">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Enter your password to confirm</span>
            <input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} className={`mt-1 ${inputCls}`} />
          </label>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={busy || !password}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold disabled:opacity-50">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} Delete permanently
            </button>
            <button type="button" onClick={() => { setOpen(false); setPassword(''); setError(''); }}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">
              Cancel
            </button>
          </div>
        </form>
      )}
    </SettingsCard>
  );
};

export default DeleteAccountCard;
