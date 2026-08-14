import React from 'react';

const inputCls = "w-full px-3 py-2.5 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500";

/**
 * Two native `<input type="date">` fields + a nights readout. No calendar
 * library — matches this project's existing zero-dependency bias (see the
 * Nominatim geocoding integration). Controlled: pass `checkIn`/`checkOut`
 * (ISO date strings) and `onChange({checkIn, checkOut})`.
 */
const DateRangePicker = ({ checkIn, checkOut, onChange, minDate, className = '' }) => {
  const today = new Date().toISOString().split('T')[0];
  const min = minDate || today;

  const nights = checkIn && checkOut
    ? Math.max(0, Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000))
    : 0;

  const setCheckIn = (e) => {
    const value = e.target.value;
    // Keep check-out valid (at least a day after) rather than letting it
    // silently become an invalid <= check-in range.
    const nextCheckOut = checkOut && value >= checkOut
      ? new Date(new Date(value).getTime() + 86400000).toISOString().split('T')[0]
      : checkOut;
    onChange({ checkIn: value, checkOut: nextCheckOut });
  };

  const setCheckOut = (e) => onChange({ checkIn, checkOut: e.target.value });

  return (
    <div className={className}>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Check-in</label>
          <input type="date" value={checkIn || ''} min={min} onChange={setCheckIn} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Check-out</label>
          <input
            type="date"
            value={checkOut || ''}
            min={checkIn ? new Date(new Date(checkIn).getTime() + 86400000).toISOString().split('T')[0] : min}
            onChange={setCheckOut}
            className={inputCls}
          />
        </div>
      </div>
      {nights > 0 && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">{nights} night{nights !== 1 ? 's' : ''}</p>
      )}
    </div>
  );
};

export default DateRangePicker;
