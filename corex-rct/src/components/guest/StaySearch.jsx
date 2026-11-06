import React, { useEffect, useState } from 'react';
import { Minus, Plus, Search } from 'lucide-react';
import { addDaysISO, todayISO } from './guestUtils';

const fieldCls = 'w-full bg-transparent text-sm font-medium text-slate-900 dark:text-white focus:outline-none [color-scheme:light] dark:[color-scheme:dark]';
const labelCls = 'block text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';

/**
 * Check-in / check-out / guests search. Edits locally and applies on
 * Search, so the room list doesn't refetch on every keystroke.
 */
const StaySearch = ({ checkIn, checkOut, guests, onSearch, maxGuests = 10, className = '' }) => {
  const [draft, setDraft] = useState({ checkIn, checkOut, guests });
  useEffect(() => { setDraft({ checkIn, checkOut, guests }); }, [checkIn, checkOut, guests]);

  const today = todayISO();
  const setCheckIn = (value) => setDraft(d => ({
    ...d,
    checkIn: value,
    checkOut: d.checkOut && d.checkOut > value ? d.checkOut : (value ? addDaysISO(value, 1) : d.checkOut),
  }));

  const submit = (e) => {
    e.preventDefault();
    onSearch(draft);
  };

  return (
    <form
      onSubmit={submit}
      className={`grid grid-cols-2 md:grid-cols-[1fr_1fr_auto_auto] gap-px overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-200 dark:bg-slate-700 shadow-lg ${className}`}
    >
      <label className="bg-white dark:bg-slate-800 px-4 py-3 cursor-pointer">
        <span className={labelCls}>Check-in</span>
        <input type="date" min={today} value={draft.checkIn} onChange={e => setCheckIn(e.target.value)} className={fieldCls} aria-label="Check-in date" />
      </label>
      <label className="bg-white dark:bg-slate-800 px-4 py-3 cursor-pointer">
        <span className={labelCls}>Check-out</span>
        <input
          type="date"
          min={draft.checkIn ? addDaysISO(draft.checkIn, 1) : addDaysISO(today, 1)}
          value={draft.checkOut}
          onChange={e => setDraft(d => ({ ...d, checkOut: e.target.value }))}
          className={fieldCls}
          aria-label="Check-out date"
        />
      </label>
      <div className="bg-white dark:bg-slate-800 px-4 py-3 col-span-2 md:col-span-1 flex items-center justify-between gap-4">
        <div>
          <span className={labelCls}>Guests</span>
          <span className="block text-sm font-medium text-slate-900 dark:text-white">{draft.guests} guest{draft.guests > 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Fewer guests" disabled={draft.guests <= 1}
            onClick={() => setDraft(d => ({ ...d, guests: Math.max(1, d.guests - 1) }))}
            className="w-8 h-8 rounded-full border border-slate-300 dark:border-slate-600 flex items-center justify-center text-slate-600 dark:text-slate-300 disabled:opacity-30">
            <Minus className="w-4 h-4" />
          </button>
          <button type="button" aria-label="More guests" disabled={draft.guests >= maxGuests}
            onClick={() => setDraft(d => ({ ...d, guests: Math.min(maxGuests, d.guests + 1) }))}
            className="w-8 h-8 rounded-full border border-slate-300 dark:border-slate-600 flex items-center justify-center text-slate-600 dark:text-slate-300 disabled:opacity-30">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="bg-white dark:bg-slate-800 p-2 col-span-2 md:col-span-1 flex">
        <button type="submit" className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold">
          <Search className="w-4 h-4" /> Search
        </button>
      </div>
    </form>
  );
};

export default StaySearch;
