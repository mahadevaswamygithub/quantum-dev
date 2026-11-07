import React from 'react';
import { Star } from 'lucide-react';

/** Read-only 1–5 star display. */
const Stars = ({ value, size = 'w-4 h-4' }) => (
  <span className="inline-flex" aria-label={`${value} out of 5`}>
    {[1, 2, 3, 4, 5].map(i => (
      <Star key={i} className={`${size} ${i <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600'}`} />
    ))}
  </span>
);

export default Stars;
