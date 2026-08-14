import React from 'react';
import { Search } from 'lucide-react';

const inputCls = "w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500";

/**
 * Generic search+filters toolbar shell — refactors the repeated inline
 * toolbar markup (search box + filter selects) duplicated across
 * OrganizationsList/UsersList/ActivityLog into one reusable piece. Extra
 * filter controls (selects, date inputs, view-mode toggles, ...) are
 * passed as children so this stays agnostic of what's being filtered.
 */
const SearchFilterBar = ({ search, onSearchChange, placeholder = 'Search...', children, className = '' }) => (
  <div className={`bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 mb-5 flex flex-wrap gap-3 items-center ${className}`}>
    {onSearchChange && (
      <div className="flex-1 min-w-48 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input type="text" value={search} onChange={e => onSearchChange(e.target.value)} placeholder={placeholder} className={inputCls} />
      </div>
    )}
    {children}
  </div>
);

export default SearchFilterBar;
