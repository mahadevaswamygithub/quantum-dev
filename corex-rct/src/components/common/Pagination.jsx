import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Standalone pagination bar - shared by ActivityLog, OrganizationsList,
 * UsersList (any page that paginates a client-side array). Renders the
 * "Showing X–Y of Z" summary always, and page controls only when there's
 * more than one page.
 */
const Pagination = ({ page, totalPages, onPageChange, rangeStart, rangeEnd, totalCount, itemLabel = 'entries' }) => {
  if (totalCount === 0) return null;

  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter(n => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
    .reduce((acc, n) => {
      if (acc.length && n - acc[acc.length - 1] > 1) acc.push('…');
      acc.push(n);
      return acc;
    }, []);

  return (
    <div className="flex-shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 mt-4">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Showing <span className="font-medium text-slate-700 dark:text-slate-300">{rangeStart}</span>
        {'–'}
        <span className="font-medium text-slate-700 dark:text-slate-300">{rangeEnd}</span>
        {' of '}
        <span className="font-medium text-slate-700 dark:text-slate-300">{totalCount}</span> {itemLabel}
      </p>
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page === 1}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Prev
          </button>
          {pageNumbers.map((n, i) => n === '…' ? (
            <span key={`gap${i}`} className="px-1.5 text-xs text-slate-400">…</span>
          ) : (
            <button
              key={n}
              onClick={() => onPageChange(n)}
              className={`min-w-[28px] px-2 py-1.5 rounded-lg text-xs font-medium ${
                n === page
                  ? 'bg-green-500 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              {n}
            </button>
          ))}
          <button
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none"
          >
            Next <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};

export default Pagination;
