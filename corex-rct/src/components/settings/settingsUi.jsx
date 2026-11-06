import React, { useCallback, useState } from 'react';
import { AlertCircle, Check, Loader2, Save } from 'lucide-react';

/** Shared building blocks for the Settings tabs. */

export const inputCls =
  'w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-60';

export const SettingsCard = ({ title, description, actions, children, className = '' }) => (
  <section className={`bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl ${className}`}>
    {(title || actions) && (
      <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
        <div className="min-w-0">
          {title && <h2 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h2>}
          {description && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
        </div>
        {actions}
      </header>
    )}
    <div className="p-5">{children}</div>
  </section>
);

export const Field = ({ label, hint, htmlFor, children, className = '' }) => (
  <div className={className}>
    <label htmlFor={htmlFor} className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">{label}</label>
    {children}
    {hint && <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{hint}</p>}
  </div>
);

/** Pulls the first readable message out of a DRF error response. */
export const apiErrorMessage = (err, fallback = 'Something went wrong') => {
  const data = err?.response?.data;
  if (!data) return fallback;
  if (typeof data === 'string') return fallback;
  if (data.error) return data.error;
  if (data.detail) return data.detail;
  const first = Object.values(data)[0];
  if (Array.isArray(first) && first.length) return String(first[0]);
  if (typeof first === 'string') return first;
  return fallback;
};

/** saving / saved / error state for a form's save button. */
export const useSaveState = () => {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const run = useCallback(async (fn, fallback) => {
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      const result = await fn();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      return result;
    } catch (err) {
      setError(apiErrorMessage(err, fallback));
      return undefined;
    } finally {
      setSaving(false);
    }
  }, []);

  return { saving, saved, error, setError, run };
};

export const SaveButton = ({ saving, saved, label = 'Save changes', disabled, ...props }) => (
  <button
    type="submit"
    disabled={saving || disabled}
    className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white text-sm font-semibold rounded-lg transition-all disabled:opacity-50 disabled:pointer-events-none"
    {...props}
  >
    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
    {saving ? 'Saving…' : saved ? 'Saved' : label}
  </button>
);

export const FormFooter = ({ error, children }) => (
  <div className="flex flex-wrap items-center justify-end gap-3 pt-4 mt-4 border-t border-slate-100 dark:border-slate-700">
    {error && (
      <p className="mr-auto flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
        <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
      </p>
    )}
    {children}
  </div>
);

export const Toggle = ({ checked, onChange, label, description, disabled }) => (
  <label className={`flex items-start justify-between gap-4 ${disabled ? 'opacity-60' : 'cursor-pointer'}`}>
    <span className="min-w-0">
      <span className="block text-sm font-medium text-slate-900 dark:text-white">{label}</span>
      {description && <span className="block text-sm text-slate-500 dark:text-slate-400">{description}</span>}
    </span>
    <span className="relative inline-flex flex-shrink-0 mt-0.5">
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        onChange={e => onChange(e.target.checked)}
      />
      <span className="w-10 h-6 rounded-full bg-slate-300 dark:bg-slate-600 peer-checked:bg-green-500 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-green-500 peer-focus-visible:ring-offset-2 dark:peer-focus-visible:ring-offset-slate-800" />
      <span className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
    </span>
  </label>
);

export const LoadingCard = () => (
  <div className="flex items-center justify-center py-16 text-slate-400">
    <Loader2 className="w-6 h-6 animate-spin" />
  </div>
);

export const ErrorCard = ({ message }) => (
  <div className="flex items-center gap-2 p-4 rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 text-sm text-red-700 dark:text-red-300">
    <AlertCircle className="w-4 h-4 flex-shrink-0" />{message}
  </div>
);
