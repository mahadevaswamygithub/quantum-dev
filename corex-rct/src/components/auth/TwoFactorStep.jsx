import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { AlertCircle, ArrowLeft, Check, Copy, Download, Loader2, ShieldCheck, Smartphone } from 'lucide-react';
import { authAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const codeCls = 'w-full px-4 py-3 text-center text-2xl tracking-[0.4em] font-mono bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500';

/** Shows backup codes once, with copy/download, before continuing. */
export const BackupCodes = ({ codes, onDone, doneLabel = 'I’ve saved these codes' }) => {
  const [copied, setCopied] = useState(false);
  const text = codes.join('\n');
  const download = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([`CoreX backup codes\n(each works once)\n\n${text}\n`], { type: 'text/plain' }));
    a.download = 'corex-backup-codes.txt';
    a.click();
  };
  return (
    <div>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Save these <b>backup codes</b> somewhere safe. If you lose your phone, each one lets you sign in once.
        They won’t be shown again.
      </p>
      <ul className="mt-4 grid grid-cols-2 gap-2 p-4 rounded-lg bg-slate-50 dark:bg-slate-700/50 font-mono text-sm text-slate-900 dark:text-white">
        {codes.map(c => <li key={c}>{c}</li>)}
      </ul>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => { navigator.clipboard?.writeText(text); setCopied(true); }}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-white">
          {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />} {copied ? 'Copied' : 'Copy'}
        </button>
        <button type="button" onClick={download}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-white">
          <Download className="w-4 h-4" /> Download
        </button>
      </div>
      {onDone && (
        <button type="button" onClick={onDone} className="mt-5 w-full py-3 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold">
          {doneLabel}
        </button>
      )}
    </div>
  );
};

/** QR + manual key + confirm code. `mfaToken` when setting up during sign-in. Calls onEnabled(responseData). */
export const TwoFactorSetup = ({ mfaToken, onEnabled }) => {
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    authAPI.setup2fa(mfaToken).then(({ data }) => setSetup(data))
      .catch(err => setError(err.response?.data?.error || 'Could not start setup. Please sign in again.'));
  }, [mfaToken]);

  const confirm = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { data } = await authAPI.enable2fa(code, mfaToken);
      onEnabled(data);
    } catch (err) {
      setError(err.response?.data?.error || 'That code didn’t match.');
      setBusy(false);
    }
  };

  if (!setup) {
    return error
      ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      : <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  }
  return (
    <form onSubmit={confirm} className="space-y-4">
      <ol className="text-sm text-slate-600 dark:text-slate-300 space-y-1 list-decimal pl-5">
        <li>Open an authenticator app (Google Authenticator, Microsoft Authenticator, Authy…).</li>
        <li>Scan this QR code, or enter the key by hand.</li>
        <li>Type the 6-digit code it shows.</li>
      </ol>
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="p-3 bg-white rounded-xl border border-slate-200"><QRCodeSVG value={setup.otpauth_uri} size={148} /></div>
        <div className="min-w-0 text-sm">
          <p className="text-xs text-slate-500 dark:text-slate-400">Key (if you can’t scan)</p>
          <p className="mt-1 font-mono break-all text-slate-900 dark:text-white select-all">{setup.secret.match(/.{1,4}/g).join(' ')}</p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Account: {setup.account}</p>
        </div>
      </div>
      <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} autoFocus
        onChange={e => setCode(e.target.value.replace(/\D/g, ''))} placeholder="123456" className={codeCls} aria-label="6-digit code" />
      {error && <p className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400"><AlertCircle className="w-4 h-4" />{error}</p>}
      <button type="submit" disabled={busy || code.length !== 6}
        className="w-full py-3 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
        {busy && <Loader2 className="w-4 h-4 animate-spin" />} Turn on two-step verification
      </button>
    </form>
  );
};

/**
 * Sign-in step after a correct password: enter a code ('verify'), or set up
 * two-step verification first ('setup', for roles that require it).
 * onSignedIn(user) is called once tokens are stored.
 */
const TwoFactorStep = ({ mfa, onSignedIn, onCancel }) => {
  const { completeLogin } = useAuth();
  const [code, setCode] = useState('');
  const [useBackup, setUseBackup] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(null); // setup finished: show backup codes before entering

  const verify = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { data } = await authAPI.verify2fa(mfa.token, code);
      onSignedIn(completeLogin(data));
    } catch (err) {
      setError(err.response?.data?.error || 'That code isn’t right.');
      if (err.response?.status === 401) setTimeout(onCancel, 1500); // ticket expired → back to password
      setBusy(false);
    }
  };

  return (
    <div>
      <button type="button" onClick={onCancel} className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-white">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <div className="flex items-center gap-3 mb-4">
        <span className="w-10 h-10 rounded-xl bg-green-500/10 text-green-600 flex items-center justify-center">
          {mfa.step === 'setup' ? <ShieldCheck className="w-5 h-5" /> : <Smartphone className="w-5 h-5" />}
        </span>
        <div>
          <h2 className="font-semibold text-slate-900 dark:text-white">
            {pending ? 'Save your backup codes' : mfa.step === 'setup' ? 'Set up two-step verification' : 'Two-step verification'}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {pending ? 'Then you’re in.' : mfa.step === 'setup' ? 'Required for your role - it takes a minute.' : 'Enter the code from your authenticator app.'}
          </p>
        </div>
      </div>

      {pending ? (
        <BackupCodes codes={pending.backup_codes} onDone={() => onSignedIn(completeLogin(pending))} doneLabel="I’ve saved them - continue" />
      ) : mfa.step === 'setup' ? (
        <TwoFactorSetup mfaToken={mfa.token} onEnabled={setPending} />
      ) : (
        <form onSubmit={verify} className="space-y-4">
          {useBackup ? (
            <input value={code} onChange={e => setCode(e.target.value.trim())} placeholder="abcd-1234" autoFocus
              className={codeCls.replace('tracking-[0.4em] ', 'tracking-wider ')} aria-label="Backup code" />
          ) : (
            <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} autoFocus
              onChange={e => setCode(e.target.value.replace(/\D/g, ''))} placeholder="123456" className={codeCls} aria-label="6-digit code" />
          )}
          {error && <p className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400"><AlertCircle className="w-4 h-4" />{error}</p>}
          <button type="submit" disabled={busy || (!useBackup && code.length !== 6) || (useBackup && code.length < 8)}
            className="w-full py-3 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} Verify
          </button>
          <button type="button" onClick={() => { setUseBackup(b => !b); setCode(''); setError(''); }}
            className="w-full text-sm text-green-600 hover:text-green-700 dark:text-green-400">
            {useBackup ? 'Use a code from my app instead' : 'Lost your phone? Use a backup code'}
          </button>
        </form>
      )}
    </div>
  );
};

export default TwoFactorStep;
