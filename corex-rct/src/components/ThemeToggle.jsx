import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const OPTIONS = [
  { mode: 'light', icon: Sun, label: 'Light' },
  { mode: 'dark', icon: Moon, label: 'Dark' },
  { mode: 'system', icon: Monitor, label: 'System' },
];

/**
 * Three-way Light / Dark / System theme switcher.
 */
const ThemeToggle = ({ className = '' }) => {
  const { mode, setMode } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={`inline-flex items-center gap-0.5 p-1 rounded-lg bg-slate-100 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-700 ${className}`}
    >
      {OPTIONS.map(({ mode: m, icon: Icon, label }) => {
        const active = mode === m;
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={active}
            title={`${label} mode`}
            onClick={() => setMode(m)}
            className={`p-1.5 rounded-md transition-all ${
              active
                ? 'bg-white dark:bg-slate-600 text-green-600 dark:text-green-400 shadow-sm'
                : 'text-slate-400 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className="sr-only">{label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default ThemeToggle;
