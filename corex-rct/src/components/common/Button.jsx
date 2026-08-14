import React from 'react';

/**
 * Standard action button — every "Add X" / toolbar action across list pages
 * (Organizations, Users, Rooms, Properties, ...) uses this so they stay the
 * same size and weight regardless of which portal (MSP/STP) renders them,
 * instead of each page hand-rolling its own one-off (e.g. Users' old
 * "Add User" button was px-6 py-3 with a different gradient than every
 * other "Add X" button's px-4 py-2 — that drift is what this fixes).
 */
const VARIANTS = {
  primary: 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white',
  secondary: 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-white border border-slate-300 dark:border-slate-600',
  danger: 'bg-red-500 hover:bg-red-600 text-white',
  ghost: 'bg-transparent hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300',
};

const Button = ({ variant = 'primary', icon: Icon, children, className = '', ...props }) => (
  <button
    className={`inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap ${VARIANTS[variant] || VARIANTS.primary} ${className}`}
    {...props}
  >
    {Icon && <Icon className="w-4 h-4" />}
    {children}
  </button>
);

export default Button;
