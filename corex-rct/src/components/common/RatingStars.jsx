import React from 'react';
import { Star } from 'lucide-react';

/**
 * Display-only star rating. Not wired to any real reviews data yet (no
 * reviews model in this scope) — built now so a future reviews feature
 * has a ready-made piece to render into.
 */
const RatingStars = ({ value = 0, count, size = 'w-4 h-4' }) => (
  <div className="inline-flex items-center gap-1">
    <div className="flex">
      {[1, 2, 3, 4, 5].map(n => (
        <Star
          key={n}
          className={`${size} ${n <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600'}`}
        />
      ))}
    </div>
    {count !== undefined && <span className="text-xs text-slate-500 dark:text-slate-400">({count})</span>}
  </div>
);

export default RatingStars;
