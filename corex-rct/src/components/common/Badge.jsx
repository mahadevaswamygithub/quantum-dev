import React from 'react';

/**
 * Generic status pill. Generalizes the `bg-*-500/20 text-*-600` badge
 * markup that used to be written inline on every list page
 * (OrganizationsList/UsersList/ActivityLog). `tone` picks the color; the
 * children are the label, so callers control the wording.
 */
const TONE_CLASSES = {
  green: 'bg-green-500/20 text-green-600 dark:text-green-400',
  red: 'bg-red-500/20 text-red-600 dark:text-red-400',
  amber: 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
  blue: 'bg-blue-500/20 text-blue-600 dark:text-blue-400',
  purple: 'bg-purple-500/20 text-purple-600 dark:text-purple-400',
  slate: 'bg-slate-500/20 text-slate-600 dark:text-slate-400',
};

const Badge = ({ tone = 'slate', icon: Icon, children, className = '' }) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${TONE_CLASSES[tone] || TONE_CLASSES.slate} ${className}`}>
    {Icon && <Icon className="w-3 h-3" />}
    {children}
  </span>
);

export default Badge;
