import React from 'react';
import { Monitor, Moon, Palette, Sun } from 'lucide-react';
import GuestAccountLayout from '../../components/guest/GuestAccountLayout';
import SecurityTab from '../../components/settings/SecurityTab';
import DeleteAccountCard from '../../components/guest/DeleteAccountCard';
import { useTheme } from '../../context/ThemeContext';

const THEMES = [
  { mode: 'light', label: 'Light', icon: Sun },
  { mode: 'dark', label: 'Dark', icon: Moon },
  { mode: 'system', label: 'Match my device', icon: Monitor },
];

/** Guest settings: appearance, password & two-step verification, delete account. */
const GuestSettings = () => {
  const { mode, setMode } = useTheme();
  return (
    <GuestAccountLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Settings</h1>
          <p className="text-slate-500 dark:text-slate-400">Appearance, sign-in security and your account.</p>
        </div>

        <section className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="flex items-center gap-2 font-bold text-slate-900 dark:text-white"><Palette className="w-5 h-5 text-green-600 dark:text-green-400" />Appearance</h3>
          <div role="radiogroup" aria-label="Theme" className="mt-4 grid gap-3 sm:grid-cols-3">
            {THEMES.map(({ mode: m, label, icon: Icon }) => (
              <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)}
                className={`flex items-center gap-3 p-4 rounded-xl border text-left text-sm font-semibold transition-colors ${
                  mode === m ? 'border-green-500 bg-green-50 text-green-800 dark:bg-green-500/10 dark:text-green-300' : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-slate-300'
                }`}>
                <Icon className="w-5 h-5" />{label}
              </button>
            ))}
          </div>
        </section>

        <SecurityTab />
        <DeleteAccountCard />
      </div>
    </GuestAccountLayout>
  );
};

export default GuestSettings;
