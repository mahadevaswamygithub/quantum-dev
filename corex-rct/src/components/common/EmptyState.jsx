import React from 'react';

/**
 * Icon + message shell for "nothing here yet" states - reused for
 * "no rooms" / "no bookings" / etc instead of ad hoc centered <p> tags.
 */
const EmptyState = ({ icon: Icon, title, description, action, className = '' }) => (
  <div className={`flex flex-col items-center justify-center text-center py-12 px-4 ${className}`}>
    {Icon && (
      <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-3">
        <Icon className="w-6 h-6 text-slate-400" />
      </div>
    )}
    <p className="text-slate-700 dark:text-slate-300 font-medium text-sm">{title}</p>
    {description && <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 max-w-sm">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export default EmptyState;
