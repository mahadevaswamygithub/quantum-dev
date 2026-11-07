import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, CalendarDays, MapPin, Minus, Plus, Search, Users } from 'lucide-react';
import DateRangeCalendar from './DateRangeCalendar';
import { shortPlace } from './StayCards';
import { formatDate } from './guestUtils';
import { loadPublicStays } from './publicStays';
import { BTN_PRIMARY } from './site';

const STYLES = {
  // Frosted panel on top of a hero photo.
  glass: {
    panel: 'rounded-2xl border border-white/15 bg-navy-950/45 backdrop-blur-md shadow-2xl shadow-black/20 p-4 sm:p-5',
    label: 'text-white/75',
    box: 'border-white/20 bg-white/10 text-white hover:bg-white/15',
    open: 'border-green-300 bg-white/15 ring-4 ring-green-400/20',
    input: 'text-white placeholder-white/50',
    muted: 'text-white/50',
    icon: 'text-green-300',
  },
  // Plain white bar on a page.
  light: {
    panel: 'rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm p-3 sm:p-4',
    label: 'text-slate-500 dark:text-slate-400',
    box: 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white hover:border-slate-300 dark:hover:border-slate-500',
    open: 'border-green-500 ring-4 ring-green-500/15',
    input: 'text-slate-900 dark:text-white placeholder-slate-400',
    muted: 'text-slate-400',
    icon: 'text-green-600 dark:text-green-400',
  },
};

const POPOVER = 'absolute z-50 mt-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-2xl shadow-black/20 animate-pop-in motion-reduce:animate-none origin-top';

const Label = ({ s, children }) => (
  <span className={`block mb-1.5 text-[11px] font-bold uppercase tracking-wider ${s.label}`}>{children}</span>
);

/** A clickable field "box" that opens a popover. */
const Trigger = ({ s, open, icon: Icon, onClick, children, label }) => (
  <button
    type="button"
    onClick={onClick}
    aria-expanded={open}
    aria-label={label}
    className={`w-full flex items-center gap-2.5 h-12 px-3.5 rounded-xl border text-left text-sm font-semibold transition-all ${s.box} ${open ? s.open : ''}`}
  >
    <Icon className={`w-4 h-4 flex-shrink-0 ${s.icon}`} />
    <span className="truncate">{children}</span>
  </button>
);

/**
 * Where / when / who search. Each field opens an animated popover: place
 * suggestions, a two-month range calendar and a guest counter. Edits stay
 * local until submit, so results don't refetch on every click.
 */
const StaySearch = ({
  checkIn = '', checkOut = '', guests = 1, destination = '',
  onSearch, withDestination = false, requireDestination = false, stacked = false, variant = 'light', maxGuests = 10, submitLabel = 'Search stays', className = '',
}) => {
  const s = STYLES[variant] || STYLES.light;
  const [draft, setDraft] = useState({ checkIn, checkOut, guests, destination });
  useEffect(() => { setDraft({ checkIn, checkOut, guests, destination }); }, [checkIn, checkOut, guests, destination]);
  const [open, setOpen] = useState(null); // 'where' | 'dates' | 'guests' | null
  const [whereError, setWhereError] = useState('');
  const whereRef = useRef(null);
  const rootRef = useRef(null);
  const toggle = (name) => setOpen(o => (o === name ? null : name));

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(null); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(null); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  // Destination suggestions: matching areas and properties.
  const [stays, setStays] = useState([]);
  useEffect(() => {
    if (!withDestination) return undefined;
    let cancelled = false;
    loadPublicStays().then(list => { if (!cancelled) setStays(list); });
    return () => { cancelled = true; };
  }, [withDestination]);
  const suggestions = useMemo(() => {
    const q = draft.destination.trim().toLowerCase();
    const places = [...new Set(stays.map(st => shortPlace(st.address)).filter(Boolean))]
      .filter(p => !q || p.toLowerCase().includes(q))
      .map(p => ({ key: `p:${p}`, icon: MapPin, title: p, sub: 'Area', value: p }));
    const props = stays
      .filter(st => !q || `${st.name} ${st.address || ''}`.toLowerCase().includes(q))
      .map(st => ({ key: `s:${st.id}`, icon: Building2, title: st.name, sub: shortPlace(st.address) || 'Property', value: st.name }));
    return [...places.slice(0, 4), ...props.slice(0, 6)];
  }, [stays, draft.destination]);

  const submit = (e) => {
    e.preventDefault();
    if (withDestination && requireDestination && !draft.destination.trim()) {
      setWhereError('Please enter a destination, city or property');
      setOpen(null);
      whereRef.current?.focus();
      return;
    }
    setOpen(null);
    onSearch({ ...draft, destination: draft.destination.trim() });
  };

  // `stacked`: a narrow column (destination / dates side by side / guests).
  const grid = stacked
    ? 'grid gap-3 sm:grid-cols-2'
    : withDestination
    ? 'grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]'
    : 'grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end';
  const stepBtn = 'w-9 h-9 rounded-full border border-slate-300 dark:border-slate-600 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:border-green-500 hover:text-green-600 disabled:opacity-30 transition-colors';


  const suggestionPopover = (pos) => open === 'where' && suggestions.length > 0 && (
              <ul className={`${POPOVER} ${pos} p-2 max-h-80 overflow-y-auto`}>
                {suggestions.map(({ key, icon: Icon, title, sub, value }) => (
                  <li key={key}>
                    <button
                      type="button"
                      onClick={() => { setDraft(d => ({ ...d, destination: value })); setOpen('dates'); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                      <span className="w-9 h-9 rounded-lg bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 flex items-center justify-center flex-shrink-0"><Icon className="w-4 h-4" /></span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-slate-900 dark:text-white truncate">{title}</span>
                        <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">{sub}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
  );
  const calendarPopover = (pos) => open === 'dates' && (
            <div className={`${POPOVER} ${pos} p-5 w-[min(calc(100vw-2rem),21rem)] sm:w-auto`}>
              <DateRangeCalendar
                checkIn={draft.checkIn}
                checkOut={draft.checkOut}
                onChange={(r) => setDraft(d => ({ ...d, ...r }))}
                onDone={() => setOpen(null)}
              />
            </div>
  );
  const guestsPopover = (pos) => open === 'guests' && (
            <div className={`${POPOVER} ${pos} w-72 p-5`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">Guests</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Per room</p>
                </div>
                <div className="flex items-center gap-3">
                  <button type="button" aria-label="Fewer guests" disabled={draft.guests <= 1}
                    onClick={() => setDraft(d => ({ ...d, guests: Math.max(1, d.guests - 1) }))} className={stepBtn}>
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-6 text-center text-lg font-bold text-slate-900 dark:text-white tabular-nums">{draft.guests}</span>
                  <button type="button" aria-label="More guests" disabled={draft.guests >= maxGuests}
                    onClick={() => setDraft(d => ({ ...d, guests: Math.min(maxGuests, d.guests + 1) }))} className={stepBtn}>
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-6 gap-1.5">
                {[1, 2, 3, 4, 5, 6].map(n => (
                  <button key={n} type="button" onClick={() => setDraft(d => ({ ...d, guests: n }))}
                    className={`h-9 rounded-lg text-sm font-semibold transition-colors ${draft.guests === n ? 'bg-gradient-to-br from-green-500 to-blue-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600'}`}>
                    {n}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => setOpen(null)} className="mt-4 w-full h-10 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-semibold">Done</button>
            </div>
  );
  const setWhere = (e) => { setDraft(d => ({ ...d, destination: e.target.value })); setOpen('where'); setWhereError(''); };

  // `pill`: one rounded bar (Where | Check-in | Check-out | Guests | search).
  if (variant === 'pill') {
    const seg = (name) => `relative flex-1 min-w-0 text-left px-6 py-3 rounded-full transition-colors ${
      open === name ? 'bg-white/25 shadow-lg shadow-black/10' : 'hover:bg-white/10'
    }`;
    const segLabel = 'block text-xs font-bold text-white';
    const segValue = 'block text-sm text-white/75 truncate';
    const divider = <span aria-hidden="true" className="hidden md:block w-px h-8 bg-white/20" />;
    return (
      <form onSubmit={submit} role="search" ref={rootRef} className={`relative ${className}`}>
        <div className={`flex flex-col md:flex-row md:items-center gap-1 p-2 md:p-1.5 rounded-3xl md:rounded-full border bg-slate-950/35 backdrop-blur-xl backdrop-saturate-150 shadow-2xl shadow-black/25 transition-colors ${whereError ? 'border-red-400/80' : 'border-white/30'} ${open ? 'bg-slate-950/45' : ''}`}>
          {withDestination && (
            <>
              <label className={`${seg('where')} md:flex-[1.4] cursor-text ${whereError ? 'ring-2 ring-red-400/80' : ''}`}>
                <span className={segLabel}>Where</span>
                <input
                  ref={whereRef}
                  aria-invalid={!!whereError}
                  aria-describedby={whereError ? 'where-error' : undefined}
                  type="search"
                  value={draft.destination}
                  onFocus={() => setOpen('where')}
                  onChange={setWhere}
                  placeholder="Search places or properties"
                  aria-label="Destination"
                  autoComplete="off"
                  className="block w-full bg-transparent text-sm text-white placeholder-white/70 focus:outline-none"
                />
                {suggestionPopover('left-0 top-full w-full min-w-[20rem]')}
              </label>
              {divider}
            </>
          )}
          <div className="relative flex-[1.6] flex flex-col md:flex-row md:items-center gap-1 min-w-0">
            <button type="button" className={seg('dates')} onClick={() => toggle('dates')} aria-expanded={open === 'dates'} aria-label="Choose check-in date">
              <span className={segLabel}>Check-in</span>
              <span className={segValue}>{draft.checkIn ? formatDate(draft.checkIn) : 'Add date'}</span>
            </button>
            {divider}
            <button type="button" className={seg('dates')} onClick={() => toggle('dates')} aria-expanded={open === 'dates'} aria-label="Choose check-out date">
              <span className={segLabel}>Check-out</span>
              <span className={segValue}>{draft.checkOut ? formatDate(draft.checkOut) : 'Add date'}</span>
            </button>
            {calendarPopover('left-0 md:left-1/2 md:-translate-x-1/2 top-full')}
          </div>
          {divider}
          <div className="relative flex-1 flex items-center gap-2 min-w-0">
            <button type="button" className={seg('guests')} onClick={() => toggle('guests')} aria-expanded={open === 'guests'} aria-label="Choose number of guests">
              <span className={segLabel}>Guests</span>
              <span className={segValue}>{draft.guests} guest{draft.guests > 1 ? 's' : ''}</span>
            </button>
            {guestsPopover('right-0 top-full')}
            <button type="submit" aria-label={submitLabel} className="hidden md:flex flex-shrink-0 items-center gap-2 h-12 pl-4 pr-5 rounded-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-semibold shadow-lg shadow-green-500/25 transition-colors">
              <Search className="w-5 h-5" /> Search
            </button>
          </div>
          <button type="submit" className={`${BTN_PRIMARY} md:hidden h-12 rounded-2xl`}>
            <Search className="w-4 h-4" /> {submitLabel}
          </button>
        </div>
        {whereError && (
          <p id="where-error" role="alert" className="mt-2 ml-6 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/90 text-white text-xs font-semibold shadow animate-pop-in">
            {whereError}
          </p>
        )}
      </form>
    );
  }

  return (
    <form onSubmit={submit} className={`${s.panel} ${className}`} role="search" ref={rootRef}>
      <div className={grid}>
        {withDestination && (
          <div className={`relative min-w-0 ${stacked ? 'sm:col-span-2' : ''}`}>
            <Label s={s}>Destination</Label>
            <div className={`flex items-center gap-2.5 h-12 px-3.5 rounded-xl border transition-all ${s.box} ${open === 'where' ? s.open : ''}`}>
              <MapPin className={`w-4 h-4 flex-shrink-0 ${s.icon}`} />
              <input
                type="search"
                value={draft.destination}
                onFocus={() => setOpen('where')}
                onChange={setWhere}
                placeholder="City, area or property"
                className={`w-full min-w-0 bg-transparent text-sm font-semibold focus:outline-none ${s.input}`}
                aria-label="Destination"
                autoComplete="off"
              />
            </div>
            {suggestionPopover('left-0 w-full min-w-[18rem]')}
          </div>
        )}

        {/* Check-in / check-out share one calendar popover. */}
        <div className="relative min-w-0">
          <Label s={s}>Check-in</Label>
          <Trigger s={s} open={open === 'dates' && !draft.checkIn} icon={CalendarDays} onClick={() => toggle('dates')} label="Choose check-in date">
            {draft.checkIn ? formatDate(draft.checkIn) : <span className={s.muted}>Add date</span>}
          </Trigger>
          {calendarPopover('left-0')}
        </div>
        <div className="min-w-0">
          <Label s={s}>Check-out</Label>
          <Trigger s={s} open={open === 'dates' && !!draft.checkIn} icon={CalendarDays} onClick={() => toggle('dates')} label="Choose check-out date">
            {draft.checkOut ? formatDate(draft.checkOut) : <span className={s.muted}>Add date</span>}
          </Trigger>
        </div>

        <div className={`relative min-w-0 ${stacked ? 'sm:col-span-2' : ''}`}>
          <Label s={s}>Guests</Label>
          <Trigger s={s} open={open === 'guests'} icon={Users} onClick={() => toggle('guests')} label="Choose number of guests">
            {draft.guests} guest{draft.guests > 1 ? 's' : ''}
          </Trigger>
          {guestsPopover('right-0')}
        </div>

        {!withDestination && !stacked && (
          <button type="submit" className={`${BTN_PRIMARY} h-12 px-7 sm:col-span-2 lg:col-span-1`}>
            <Search className="w-4 h-4" /> {submitLabel}
          </button>
        )}
      </div>
      {(withDestination || stacked) && (
        <button type="submit" className={`${BTN_PRIMARY} mt-4 w-full h-12 text-base`}>
          <Search className="w-4 h-4" /> {submitLabel}
        </button>
      )}
    </form>
  );
};

export default StaySearch;
