import React from 'react';
import { RefreshCw } from 'lucide-react';

const ago = (ts) => {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  return m < 60 ? `${m} min ago` : `${Math.round(m / 60)} hr ago`;
};

/** Green ⟳ button paired with useAutoRefresh. When it last updated is in the tooltip only. */
const RefreshButton = ({ onClick, refreshing, lastUpdated, className = '' }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={refreshing}
    title={refreshing ? 'Refreshing…' : `Refresh (updated ${ago(lastUpdated)})`}
    aria-label="Refresh"
    className={`p-2 rounded-lg bg-green-500/10 text-green-600 hover:bg-green-500/20 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 border border-green-500/20 transition-colors disabled:opacity-70 ${className}`}
  >
    <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
  </button>
);

export default RefreshButton;
