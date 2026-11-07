import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { nightsBetween, todayISO } from './guestUtils';

const pad = (n) => String(n).padStart(2, '0');
const iso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const Month = ({ year, month, checkIn, checkOut, hover, onPick, onHover }) => {
  const today = todayISO();
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  // While choosing the check-out, preview the range up to the hovered day.
  const end = checkOut || (checkIn && hover && hover > checkIn ? hover : '');
  const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];

  return (
    <div className="w-full sm:w-[17rem]">
      <p className="text-center text-sm font-bold text-slate-900 dark:text-white mb-3">
        {new Date(year, month, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
      </p>
      <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-slate-400 mb-1">
        {WEEKDAYS.map(d => <span key={d} className="py-1">{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-y-1" onMouseLeave={() => onHover('')}>
        {cells.map((d, i) => {
          if (!d) return <span key={`b${i}`} />;
          const date = iso(year, month, d);
          const past = date < today;
          const isStart = date === checkIn;
          const isEnd = date === end;
          const inRange = checkIn && end && date > checkIn && date < end;
          return (
            <div
              key={date}
              className={`relative h-9 ${inRange ? 'bg-green-500/10 dark:bg-green-400/10' : ''} ${isStart && end ? 'bg-gradient-to-r from-transparent from-50% to-green-500/10 to-50% dark:to-green-400/10' : ''} ${isEnd && checkIn ? 'bg-gradient-to-l from-transparent from-50% to-green-500/10 to-50% dark:to-green-400/10' : ''}`}
            >
              <button
                type="button"
                disabled={past}
                onClick={() => onPick(date)}
                onMouseEnter={() => onHover(date)}
                aria-label={new Date(year, month, d).toDateString()}
                aria-pressed={isStart || isEnd}
                className={`relative w-9 h-9 mx-auto flex items-center justify-center rounded-full text-sm transition-colors ${
                  past ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                    : isStart || isEnd ? 'bg-gradient-to-br from-green-500 to-blue-500 text-white font-bold shadow-md shadow-green-500/30'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                } ${date === today && !isStart && !isEnd ? 'ring-1 ring-green-500/60' : ''}`}
              >
                {d}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Two-month range calendar (one month on small screens). First click sets
 * check-in, second sets check-out; clicking before the check-in restarts.
 */
const DateRangeCalendar = ({ checkIn, checkOut, onChange, onDone }) => {
  const start = checkIn ? new Date(`${checkIn}T00:00`) : new Date();
  const [view, setView] = useState({ y: start.getFullYear(), m: start.getMonth() });
  const [hover, setHover] = useState('');
  const now = new Date();
  const atFirstMonth = view.y === now.getFullYear() && view.m === now.getMonth();
  const next = { y: view.m === 11 ? view.y + 1 : view.y, m: (view.m + 1) % 12 };
  const shift = (d) => setView(v => {
    const t = new Date(v.y, v.m + d, 1);
    return { y: t.getFullYear(), m: t.getMonth() };
  });

  const pick = (date) => {
    if (!checkIn || checkOut || date <= checkIn) {
      onChange({ checkIn: date, checkOut: '' });
    } else {
      onChange({ checkIn, checkOut: date });
      onDone?.();
    }
  };

  const nights = nightsBetween(checkIn, checkOut);
  const arrow = 'w-9 h-9 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent';

  return (
    <div>
      <div className="relative flex flex-col sm:flex-row gap-6 sm:gap-8">
        <button type="button" aria-label="Previous month" onClick={() => shift(-1)} disabled={atFirstMonth} className={`${arrow} absolute left-0 -top-1.5`}>
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button type="button" aria-label="Next month" onClick={() => shift(1)} className={`${arrow} absolute right-0 -top-1.5`}>
          <ChevronRight className="w-4 h-4" />
        </button>
        <Month year={view.y} month={view.m} checkIn={checkIn} checkOut={checkOut} hover={hover} onPick={pick} onHover={setHover} />
        <div className="hidden sm:block">
          <Month year={next.y} month={next.m} checkIn={checkIn} checkOut={checkOut} hover={hover} onPick={pick} onHover={setHover} />
        </div>
      </div>
      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between gap-3 text-sm">
        <span className="text-slate-500 dark:text-slate-400">
          {nights ? <><b className="text-slate-900 dark:text-white">{nights} night{nights > 1 ? 's' : ''}</b> selected</>
            : checkIn ? 'Now pick your check-out date' : 'Pick your check-in date'}
        </span>
        <span className="flex items-center gap-3">
          {(checkIn || checkOut) && (
            <button type="button" onClick={() => onChange({ checkIn: '', checkOut: '' })} className="font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white underline-offset-2 hover:underline">
              Clear
            </button>
          )}
          <button type="button" onClick={onDone} className="px-4 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold">Done</button>
        </span>
      </div>
    </div>
  );
};

export default DateRangeCalendar;
