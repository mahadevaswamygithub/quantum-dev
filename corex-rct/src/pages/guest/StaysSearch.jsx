import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowDown, ArrowUp, BadgeCheck, ChevronRight, Loader2, Lock, ShieldCheck, SlidersHorizontal, Sparkles, Star, X, Zap, SearchX,
} from 'lucide-react';
import GuestLayout from '../../components/guest/GuestLayout';
import StaySearch from '../../components/guest/StaySearch';
import { StayRow } from '../../components/guest/StayCards';
import { CONTAINER, stayQuery } from '../../components/guest/site';
import { formatDate, nightsBetween, todayISO } from '../../components/guest/guestUtils';
import { bookingAPI } from '../../services/api';

const SORTS = [
  { key: 'recommended', label: 'Recommended', icon: Sparkles },
  { key: 'price', label: 'Price', icon: ArrowUp },
  { key: 'price_desc', label: 'Price', icon: ArrowDown },
  { key: 'rating', label: 'Top rated', icon: Star },
];

const PRICE_BANDS = [
  { key: 'u1000', label: 'Under ₹1,000', min: 0, max: 999.99 },
  { key: '1000', label: '₹1,000 – ₹2,500', min: 1000, max: 2500 },
  { key: '2500', label: '₹2,500 – ₹5,000', min: 2500, max: 5000 },
  { key: '5000', label: '₹5,000 +', min: 5000, max: Infinity },
];
const RATINGS = [4.5, 4, 3.5];
const NO_FILTERS = { band: '', min: '', max: '', rating: 0, amenities: [], instant: false, payOnline: false, freeCancel: false, available: false };

const score = (s) => (s.rating_count ? s.rating_avg * Math.min(1, 0.6 + s.rating_count / 25) : 3.2);

const Option = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={`w-full text-left px-3.5 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
      active
        ? 'border-brand-500 bg-brand-50 text-brand-800 dark:bg-brand-500/10 dark:text-brand-300'
        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600'
    }`}
  >
    {children}
  </button>
);

const Check = ({ checked, onChange, children }) => (
  <label className="flex items-center gap-2.5 py-1.5 text-sm text-slate-700 dark:text-slate-200 cursor-pointer">
    <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500" />
    {children}
  </label>
);

const FilterGroup = ({ title, children }) => (
  <div className="py-5 border-t border-slate-100 dark:border-slate-700 first:border-0 first:pt-0">
    <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{title}</h3>
    {children}
  </div>
);

/**
 * Site-wide stay search: every property taking bookings, with live
 * availability for the chosen dates, sorting and filters.
 */
const StaysSearch = () => {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const sort = SORTS.some(s => s.key === params.get('sort')) ? params.get('sort') : 'recommended';
  const rawIn = params.get('check_in') || '';
  const rawOut = params.get('check_out') || '';
  const datesOk = rawIn && rawOut && rawOut > rawIn && rawIn >= todayISO();
  const checkIn = datesOk ? rawIn : '';
  const checkOut = datesOk ? rawOut : '';
  const guests = Math.max(1, Number(params.get('guests')) || 1);
  const nights = nightsBetween(checkIn, checkOut);

  const [stays, setStays] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(NO_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const setFilter = (patch) => setFilters(f => ({ ...f, ...patch }));

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const query = checkIn ? { check_in: checkIn, check_out: checkOut, guests: guests > 1 ? guests : undefined } : {};
    bookingAPI.getPublicOrgList(query)
      .then(({ data }) => { if (!cancelled) setStays(data || []); })
      .catch(() => { if (!cancelled) setStays([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [checkIn, checkOut, guests]);

  const update = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next, { replace: true });
  };
  const onSearch = (s) => update({
    q: s.destination, check_in: s.checkIn && s.checkOut ? s.checkIn : '', check_out: s.checkIn && s.checkOut ? s.checkOut : '',
    guests: s.guests > 1 ? String(s.guests) : '',
  });

  const allAmenities = useMemo(() => {
    const seen = new Map();
    (stays || []).forEach(s => (s.amenities || []).forEach(a => seen.set(a.toLowerCase(), a)));
    return [...seen.values()].slice(0, 12);
  }, [stays]);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    const band = PRICE_BANDS.find(b => b.key === filters.band);
    const min = filters.min === '' ? null : Number(filters.min);
    const max = filters.max === '' ? null : Number(filters.max);
    const list = (stays || []).filter(s => {
      const price = Number(s.min_price);
      if (term && !`${s.name} ${s.address || ''}`.toLowerCase().includes(term)) return false;
      if (guests > 1 && s.max_capacity < guests) return false;
      if (band && (price < band.min || price > band.max)) return false;
      if (min != null && price < min) return false;
      if (max != null && price > max) return false;
      if (filters.rating && !(s.rating_count && s.rating_avg >= filters.rating)) return false;
      if (filters.amenities.length) {
        const have = new Set((s.amenities || []).map(a => a.toLowerCase()));
        if (!filters.amenities.every(a => have.has(a.toLowerCase()))) return false;
      }
      if (filters.instant && !s.auto_confirm) return false;
      if (filters.payOnline && !s.online_payments) return false;
      if (filters.freeCancel && !(Number(s.free_cancellation_hours) <= 24)) return false;
      if (filters.available && s.available_rooms === 0) return false;
      return true;
    });
    const sorters = {
      recommended: (a, b) => (b.available_rooms > 0) - (a.available_rooms > 0) || score(b) - score(a),
      price: (a, b) => Number(a.min_price) - Number(b.min_price),
      price_desc: (a, b) => Number(b.min_price) - Number(a.min_price),
      rating: (a, b) => (b.rating_avg || 0) - (a.rating_avg || 0) || b.rating_count - a.rating_count,
    };
    return list.sort(sorters[sort]);
  }, [stays, q, guests, filters, sort]);

  // Badges: the best-rated and the cheapest result.
  const topId = useMemo(() => [...results].filter(s => s.rating_count).sort((a, b) => b.rating_avg - a.rating_avg)[0]?.id, [results]);
  const cheapId = useMemo(() => (results.length > 1 ? [...results].sort((a, b) => a.min_price - b.min_price)[0]?.id : null), [results]);
  const activeFilterCount = [filters.band || filters.min || filters.max, filters.rating, filters.amenities.length, filters.instant, filters.payOnline, filters.freeCancel, filters.available].filter(Boolean).length;
  const linkQuery = stayQuery({ checkIn, checkOut, guests });

  const filterPanel = (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-slate-900 dark:text-white">Filter results</h2>
        {activeFilterCount > 0 && (
          <button type="button" onClick={() => setFilters(NO_FILTERS)} className="text-sm font-semibold text-brand-700 dark:text-brand-400 hover:underline">Clear all</button>
        )}
      </div>
      <FilterGroup title="Price per night">
        <div className="space-y-2">
          {PRICE_BANDS.map(b => (
            <Option key={b.key} active={filters.band === b.key} onClick={() => setFilter({ band: filters.band === b.key ? '' : b.key, min: '', max: '' })}>{b.label}</Option>
          ))}
        </div>
        <p className="mt-3 mb-1.5 text-xs text-slate-400">Custom range</p>
        <div className="grid grid-cols-2 gap-2">
          {['min', 'max'].map(k => (
            <input
              key={k}
              type="number"
              min="0"
              inputMode="numeric"
              value={filters[k]}
              onChange={e => setFilter({ [k]: e.target.value, band: '' })}
              placeholder={k === 'min' ? 'Min ₹' : 'Max ₹'}
              aria-label={k === 'min' ? 'Minimum price' : 'Maximum price'}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          ))}
        </div>
      </FilterGroup>
      <FilterGroup title="Guest rating">
        <div className="space-y-2">
          {RATINGS.map(r => (
            <Option key={r} active={filters.rating === r} onClick={() => setFilter({ rating: filters.rating === r ? 0 : r })}>
              <span className="inline-flex items-center gap-1.5"><Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />{r}+ and above</span>
            </Option>
          ))}
        </div>
      </FilterGroup>
      <FilterGroup title="Booking options">
        {checkIn && <Check checked={filters.available} onChange={v => setFilter({ available: v })}>Rooms free for my dates</Check>}
        <Check checked={filters.instant} onChange={v => setFilter({ instant: v })}>Instant confirmation</Check>
        <Check checked={filters.freeCancel} onChange={v => setFilter({ freeCancel: v })}>Free cancellation (up to 24h before)</Check>
        <Check checked={filters.payOnline} onChange={v => setFilter({ payOnline: v })}>Pay online</Check>
      </FilterGroup>
      {allAmenities.length > 0 && (
        <FilterGroup title="Amenities">
          {allAmenities.map(a => (
            <Check
              key={a}
              checked={filters.amenities.includes(a)}
              onChange={v => setFilter({ amenities: v ? [...filters.amenities, a] : filters.amenities.filter(x => x !== a) })}
            >
              {a}
            </Check>
          ))}
        </FilterGroup>
      )}
    </div>
  );

  return (
    <GuestLayout>
      <div className={`${CONTAINER} py-6 sm:py-8`}>
        <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
          <Link to="/book" className="hover:text-brand-700 dark:hover:text-brand-400">Home</Link>
          <ChevronRight className="w-4 h-4" /><span className="text-slate-800 dark:text-slate-200 font-medium">Stays</span>
        </nav>

        <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {q ? <>Stays matching “{q}”</> : 'Search Stays'}
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {stays ? `${results.length} propert${results.length === 1 ? 'y' : 'ies'} found` : 'Loading…'}
              {checkIn && ` · ${formatDate(checkIn)} – ${formatDate(checkOut)} · ${nights} night${nights > 1 ? 's' : ''}`}
              {guests > 1 && ` · ${guests} guests`}
            </p>
          </div>
          {loading && stays && <Loader2 className="w-5 h-5 animate-spin text-slate-400" />}
        </div>

        <ul className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3 rounded-2xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
          <li className="inline-flex items-center gap-1.5"><BadgeCheck className="w-4 h-4" />Listed by the property</li>
          <li className="inline-flex items-center gap-1.5"><ShieldCheck className="w-4 h-4" />No hidden charges</li>
          <li className="inline-flex items-center gap-1.5"><Zap className="w-4 h-4" />Live availability</li>
          <li className="inline-flex items-center gap-1.5"><Lock className="w-4 h-4" />Secure payment</li>
        </ul>

        <StaySearch
          withDestination
          checkIn={checkIn}
          checkOut={checkOut}
          guests={guests}
          destination={q}
          onSearch={onSearch}
          submitLabel="Search"
          className="mt-4"
        />

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {SORTS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => update({ sort: key === 'recommended' ? '' : key })}
              aria-pressed={sort === key}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full border text-sm font-semibold transition-colors ${
                sort === key
                  ? 'border-brand-500 bg-brand-500 text-white'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-slate-300'
              }`}
            >
              {label} <Icon className="w-3.5 h-3.5" />
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowFilters(v => !v)}
            className="lg:hidden ml-auto inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold text-slate-700 dark:text-slate-200"
          >
            <SlidersHorizontal className="w-4 h-4" /> Filters{activeFilterCount ? ` (${activeFilterCount})` : ''}
          </button>
        </div>

        <div className="mt-5 grid gap-6 lg:grid-cols-[18rem_1fr] items-start">
          <aside className={`${showFilters ? 'block' : 'hidden'} lg:block lg:sticky lg:top-24`}>{filterPanel}</aside>

          <div className={`space-y-4 ${loading && stays ? 'opacity-60' : ''}`}>
            {!stays ? (
              [0, 1, 2].map(i => <div key={i} className="h-52 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />)
            ) : results.length === 0 ? (
              <div className="flex flex-col items-center text-center py-16 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800">
                <SearchX className="w-10 h-10 text-slate-300 mb-3" />
                <p className="font-semibold text-slate-900 dark:text-white">No stays match your search</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">Try other dates, fewer filters or a different place.</p>
                <div className="mt-3 flex gap-4">
                  {activeFilterCount > 0 && <button type="button" onClick={() => setFilters(NO_FILTERS)} className="text-sm font-semibold text-brand-700 dark:text-brand-400 hover:underline">Clear filters</button>}
                  {q && <button type="button" onClick={() => update({ q: '' })} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 dark:text-brand-400 hover:underline"><X className="w-3.5 h-3.5" />Clear “{q}”</button>}
                </div>
              </div>
            ) : (
              results.map(s => (
                <StayRow
                  key={s.id}
                  stay={s}
                  nights={nights}
                  to={`/book/${s.id}${linkQuery}`}
                  badge={s.id === topId ? 'Top rated' : s.id === cheapId ? 'Best price' : null}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </GuestLayout>
  );
};

export default StaysSearch;
