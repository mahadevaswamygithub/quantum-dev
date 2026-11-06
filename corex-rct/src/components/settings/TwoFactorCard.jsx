import React, { useEffect, useState } from 'react';
import { Loader2, ShieldCheck, ShieldOff } from 'lucide-react';
import { authAPI } from '../../services/api';
import { BackupCodes, TwoFactorSetup } from '../auth/TwoFactorStep';
import { SettingsCard, apiErrorMessage, inputCls } from './settingsUi';

/** My profile → Two-step verification: turn on/off, new backup codes. */
const TwoFactorCard = () => {
  const [status, setStatus] = useState(null);
  const [mode, setMode] = useState(null); // 'setup' | 'disable' | 'codes'
  const [codes, setCodes] = useState(null);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = () => authAPI.status2fa().then(({ data }) => setStatus(data)).catch(() => setStatus({ enabled: false, required: false }));
  useEffect(() => { load(); }, []);
  const reset = () => { setMode(null); setPassword(''); setCode(''); setError(''); setBusy(false); };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (mode === 'disable') {
        const { data } = await authAPI.disable2fa(password, code);
        setStatus(data);
        reset();
      } else {
        const { data } = await authAPI.newBackupCodes(code);
        setCodes(data.backup_codes);
        setStatus(data);
        reset();
      }
    } catch (err) {
      setError(apiErrorMessage(err, 'That didn’t work.'));
      setBusy(false);
    }
  };

  if (!status) return <SettingsCard title="Two-step verification"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></SettingsCard>;

  return (
    <SettingsCard
      title="Two-step verification"
      description="After your password, also enter a code from an authenticator app on your phone. Stops anyone who learns your password."
    >
      {codes ? (
        <BackupCodes codes={codes} onDone={() => setCodes(null)} doneLabel="Done" />
      ) : mode === 'setup' ? (
        <TwoFactorSetup onEnabled={(data) => { setStatus(data); setCodes(data.backup_codes); setMode(null); }} />
      ) : (
        <>
          <div className="flex items-center gap-3">
            {status.enabled
              ? <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-semibold bg-green-500/10 text-green-700 dark:text-green-400"><ShieldCheck className="w-4 h-4" /> On</span>
              : <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-semibold bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"><ShieldOff className="w-4 h-4" /> Off</span>}
            {status.enabled && <span className="text-sm text-slate-500 dark:text-slate-400">{status.backup_codes_left} backup code{status.backup_codes_left === 1 ? '' : 's'} left</span>}
            {status.required && <span className="text-sm text-slate-500 dark:text-slate-400">· required for your role</span>}
          </div>

          {!status.enabled && (
            <button type="button" onClick={() => setMode('setup')} className="mt-4 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold">
              Turn on
            </button>
          )}
          {status.enabled && !mode && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => setMode('codes')} className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-white">
                New backup codes
              </button>
              {!status.required && (
                <button type="button" onClick={() => setMode('disable')} className="px-4 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10">
                  Turn off
                </button>
              )}
            </div>
          )}

          {(mode === 'disable' || mode === 'codes') && (
            <form onSubmit={submit} className="mt-4 max-w-sm space-y-3">
              {mode === 'disable' && (
                <input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Your password" className={inputCls} />
              )}
              <input required value={code} onChange={e => setCode(e.target.value.trim())} placeholder="Code from your app (or a backup code)" className={inputCls} />
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
              <div className="flex gap-2">
                <button type="submit" disabled={busy} className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 ${mode === 'disable' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}>
                  {busy && <Loader2 className="w-4 h-4 animate-spin" />} {mode === 'disable' ? 'Turn off' : 'Get new codes'}
                </button>
                <button type="button" onClick={reset} className="px-4 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">Cancel</button>
              </div>
            </form>
          )}
        </>
      )}
    </SettingsCard>
  );
};

export default TwoFactorCard;
