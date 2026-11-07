import React from 'react';

/**
 * Shared small inline page-loading spinner, extracted from the markup
 * copy-pasted verbatim across most pages. Pass `label` to reproduce the
 * "spinner + text" variant (e.g. "Loading...") used by a couple of pages;
 * omit it for the bare-spinner variant used by the rest.
 *
 * Distinct from components/LoadingSpinner.js (a different, full-page
 * Loader2-icon spinner used only by PrivateRoute) - not merged with that
 * one since they're two different visual idioms.
 */
const PageSpinner = ({ label }) => (
  <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
    {label ? (
      <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
        <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
        {label}
      </div>
    ) : (
      <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
    )}
  </div>
);

export default PageSpinner;
