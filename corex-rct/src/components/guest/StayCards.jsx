import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BedDouble, CalendarX, CheckCircle2, MapPin, ShieldCheck, Star, Zap } from 'lucide-react';
import { amenityIcon } from './amenities';
import { formatMoney } from './guestUtils';
import { BTN_PRIMARY } from './site';
import { HeartButton } from './wishlist';

/** First part of a free-text address ("12 Beach Rd, Puducherry 605001" → "Puducherry"). */
export const shortPlace = (address = '') => {
  const parts = address.split(',').map(p => p.replace(/\b\d{5,6}\b/g, '').trim()).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : parts[0] || '';
};

/** Up to `max` amenities as icon + label cells. */
export const AmenityStrip = ({ amenities = [], max = 4 }) => {
  const shown = amenities.slice(0, max);
  if (!shown.length) return null;
  return (
    <ul className="grid divide-x divide-slate-200 dark:divide-slate-700 rounded-xl border border-slate-200 dark:border-slate-700" style={{ gridTemplateColumns: `repeat(${shown.length}, minmax(0, 1fr))` }}>
      {shown.map(a => {
        const Icon = amenityIcon(a);
        return (
          <li key={a} className="flex flex-col items-center gap-1 px-1 py-2.5 min-w-0" title={a}>
            <Icon className="w-4 h-4 text-brand-500" />
            <span className="w-full truncate text-center text-[11px] text-slate-500 dark:text-slate-400">{a}</span>
          </li>
        );
      })}
    </ul>
  );
};

const RatingPill = ({ avg, count }) => (count > 0 ? (
  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-600 text-white text-xs font-bold">
    <Star className="w-3 h-3 fill-white" />{avg}
  </span>
) : (
  <span className="inline-flex px-2 py-0.5 rounded-md bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300 text-xs font-bold">New</span>
));

const Cover = ({ stay, className, children }) => (
  <div className={`relative overflow-hidden bg-gradient-to-br from-navy-800 to-navy-700 ${className}`}>
    {stay.cover_image ? (
      <img src={stay.cover_image} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
    ) : (
      <div className="absolute inset-0 flex items-center justify-center text-white/40"><BedDouble className="w-12 h-12" /></div>
    )}
    {children}
  </div>
);

/** Vertical card for carousels/grids on the landing page. */
export const StayCard = ({ stay, to }) => {
  const place = shortPlace(stay.address);
  return (
    <Link to={to} className="group flex flex-col h-full rounded-2xl overflow-hidden bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
      <Cover stay={stay} className="aspect-[4/3]">
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent" />
        {place && (
          <span className="absolute left-3 bottom-3 inline-flex items-center gap-1 text-xs font-semibold text-white">
            <MapPin className="w-3.5 h-3.5" />{place}
          </span>
        )}
        {stay.min_price != null && (
          <span className="absolute right-3 bottom-3 px-2.5 py-1 rounded-lg bg-black/55 backdrop-blur text-white text-sm font-bold">
            {formatMoney(stay.min_price)}<span className="text-[11px] font-medium text-white/75"> /night</span>
          </span>
        )}
        {!stay.accepting_bookings && (
          <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-900/80 text-white">Not taking bookings</span>
        )}
        <HeartButton orgId={stay.id} light className="absolute top-3 right-3" />
      </Cover>
      <div className="flex flex-col flex-1 p-4 gap-3">
        <div>
          <h3 className="font-bold text-lg text-slate-900 dark:text-white truncate">{stay.name}</h3>
          <div className="mt-1 flex items-center gap-2 text-sm">
            {stay.rating_count > 0 ? (
              <>
                <span className="flex">{[1, 2, 3, 4, 5].map(i => <Star key={i} className={`w-3.5 h-3.5 ${i <= Math.round(stay.rating_avg) ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600'}`} />)}</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">{stay.rating_avg}</span>
                <span className="text-slate-400">({stay.rating_count})</span>
              </>
            ) : <span className="text-slate-400">New on the site</span>}
          </div>
        </div>
        <AmenityStrip amenities={stay.amenities} />
        <span className={`${BTN_PRIMARY} mt-auto h-11`}>Book now <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" /></span>
      </div>
    </Link>
  );
};

/** Wide result row for the stay search page. */
export const StayRow = ({ stay, to, nights = 0, badge }) => {
  const soldOut = stay.available_rooms === 0;
  const fewLeft = stay.available_rooms > 0 && stay.available_rooms <= 2;
  const perks = [
    stay.auto_confirm && { icon: Zap, text: 'Instant confirmation' },
    { icon: CheckCircle2, text: Number(stay.free_cancellation_hours) ? `Free cancellation till ${stay.free_cancellation_hours}h before` : 'Free cancellation till check-in' },
    { icon: ShieldCheck, text: stay.online_payments ? 'Pay online or at property' : 'Pay at property' },
  ].filter(Boolean);

  return (
    <Link to={to} className={`group grid sm:grid-cols-[18rem_1fr] rounded-2xl overflow-hidden bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:shadow-xl hover:border-slate-300 dark:hover:border-slate-600 transition-all ${soldOut ? 'opacity-75' : ''}`}>
      <Cover stay={stay} className="aspect-[16/10] sm:aspect-auto sm:min-h-[13rem]">
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          {badge && <span className="px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide bg-blue-600 text-white">{badge}</span>}
          {fewLeft && <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-rose-600 text-white">Only {stay.available_rooms} left</span>}
        </div>
        <HeartButton orgId={stay.id} light className="absolute top-3 right-3" />
      </Cover>

      <div className="p-4 sm:p-5 grid gap-4 md:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">{stay.name}</h3>
            <RatingPill avg={stay.rating_avg} count={stay.rating_count} />
            {stay.rating_count > 0 && <span className="text-xs text-slate-400">{stay.rating_count} review{stay.rating_count === 1 ? '' : 's'}</span>}
          </div>
          {stay.address && (
            <p className="mt-1 flex items-start gap-1.5 text-sm text-slate-500 dark:text-slate-400">
              <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" /><span className="line-clamp-1">{stay.address}</span>
            </p>
          )}
          {stay.amenities?.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {stay.amenities.slice(0, 6).map(a => {
                const Icon = amenityIcon(a);
                return (
                  <li key={a} className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">
                    <Icon className="w-3.5 h-3.5 text-slate-400" />{a}
                  </li>
                );
              })}
              {stay.amenities.length > 6 && <li className="px-2 py-1 text-xs text-slate-400">+{stay.amenities.length - 6} more</li>}
            </ul>
          )}
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
            {perks.map(({ icon: Icon, text }) => (
              <li key={text} className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400"><Icon className="w-3.5 h-3.5" />{text}</li>
            ))}
          </ul>
        </div>

        <div className="flex md:flex-col items-end justify-between gap-3 md:text-right md:min-w-[11rem] md:pl-5 md:border-l md:border-slate-100 dark:md:border-slate-700">
          <div>
            {soldOut ? (
              <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-rose-600 dark:text-rose-400"><CalendarX className="w-4 h-4" />Sold out for your dates</p>
            ) : (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Starting from</p>
                <p className="text-2xl font-extrabold text-brand-600 dark:text-brand-400">
                  {formatMoney(stay.min_price)}<span className="text-sm font-medium text-slate-400"> /night</span>
                </p>
                {nights > 1 && <p className="text-xs text-slate-500 dark:text-slate-400">{formatMoney(stay.min_price * nights)} for {nights} nights</p>}
                {stay.available_rooms > 0 && <p className="text-xs text-slate-500 dark:text-slate-400">{stay.available_rooms} room{stay.available_rooms === 1 ? '' : 's'} free</p>}
              </>
            )}
          </div>
          <span className={`${BTN_PRIMARY} h-11 px-6 whitespace-nowrap`}>{soldOut ? 'See rooms' : 'Book now'}</span>
        </div>
      </div>
    </Link>
  );
};
