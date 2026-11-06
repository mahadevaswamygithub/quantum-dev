import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle, ArrowRight, BedDouble, CalendarDays, Clock, MapPin,
} from 'lucide-react';
import GuestAccountLayout from '../../components/guest/GuestAccountLayout';
import { formatDate, formatMoney, formatTime, nightsBetween, todayISO, useGuest } from '../../components/guest/guestUtils';
import { bookingAPI } from '../../services/api';

const daysUntil = (iso) => nightsBetween(todayISO(), iso);

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

const NextTrip = ({ b }) => {
  const d = daysUntil(b.check_in);
  const when = b.status === 'CHECKED_IN' ? 'You’re staying here now'
    : d === 0 ? 'Check-in is today' : d === 1 ? 'Check-in is tomorrow' : `Check-in in ${d} days`;
  return (
    <div className="rounded-2xl overflow-hidden bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row">
      <div className="sm:w-64 aspect-[16/9] sm:aspect-auto bg-slate-100 dark:bg-slate-700 flex-shrink-0">
        {b.room_detail?.primary_image
          ? <img src={b.room_detail.primary_image} alt="" className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-slate-400"><BedDouble className="w-10 h-10" /></div>}
      </div>
      <div className="flex-1 p-5">
        <p className="text-sm font-semibold text-green-600 dark:text-green-400">{when} · {b.organization_name}</p>
        <h3 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{b.room_detail?.name}</h3>
        {b.property_name && <p className="text-sm text-slate-500 dark:text-slate-400">{b.property_name}</p>}
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-700 dark:text-slate-200">
          <span className="flex items-center gap-1.5"><CalendarDays className="w-4 h-4 text-slate-400" />{formatDate(b.check_in)} → {formatDate(b.check_out)}</span>
          {b.check_in_time && <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-slate-400" />from {formatTime(b.check_in_time)}</span>}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {b.can_pay_online && (
            <Link to="/book/me/trips" className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold">
              Pay {formatMoney(b.total_amount)}
            </Link>
          )}
          <Link to="/book/me/trips" className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700">
            View booking
          </Link>
          {b.organization_address && (
            <a target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.organization_address)}`}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white">
              <MapPin className="w-4 h-4" /> Directions
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

const Stat = ({ label, value }) => (
  <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4">
    <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
    <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white tabular-nums">{value}</p>
  </div>
);

/** Signed-in guest's home: next trip, things that need action, quick links and property contact. */
const GuestDashboard = () => {
  const { user } = useGuest();
  const [bookings, setBookings] = useState(null);

  useEffect(() => {
    bookingAPI.getBookings().then(({ data }) => setBookings(data || [])).catch(() => setBookings([]));
  }, []);

  const { upcoming, attention, completed } = useMemo(() => {
    const today = todayISO();
    const all = bookings || [];
    const up = all.filter(b => ['PENDING', 'CONFIRMED', 'CHECKED_IN'].includes(b.status) && b.check_out >= today)
      .sort((a, b) => a.check_in.localeCompare(b.check_in));
    return {
      upcoming: up,
      attention: up.filter(b => b.can_pay_online || (b.status === 'PENDING' && b.payment_method === 'AT_PROPERTY')),
      completed: all.filter(b => b.status === 'CHECKED_OUT').length,
    };
  }, [bookings]);

  return (
    <GuestAccountLayout>
      <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{greeting()}, {user?.first_name || 'there'}</h1>
      <p className="text-slate-500 dark:text-slate-400">Your trips and bookings across every property.</p>

      <section className="mt-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">Your next trip</h2>
        {!bookings ? (
          <div className="h-44 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
        ) : upcoming.length ? (
          <NextTrip b={upcoming[0]} />
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center">
            <BedDouble className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="font-semibold text-slate-900 dark:text-white">No upcoming trips</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Find a place and book your next stay.</p>
            <Link to="/book" className="mt-4 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-green-600 hover:bg-green-700 text-white text-sm font-semibold">
              Find a stay <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </section>

      {attention.length > 0 && (
        <section className="mt-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">Needs your attention</h2>
          <ul className="space-y-2">
            {attention.map(b => (
              <li key={b.id}>
                <Link to="/book/me/trips" className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 hover:border-amber-300">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                  <span className="flex-1 text-sm text-amber-900 dark:text-amber-200">
                    <b>{b.organization_name}</b> · {b.room_detail?.name} · {formatDate(b.check_in)} —{' '}
                    {b.can_pay_online ? `payment of ${formatMoney(b.total_amount)} due` : 'waiting for the property to confirm'}
                  </span>
                  <ArrowRight className="w-4 h-4 text-amber-700" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6 grid grid-cols-2 gap-3">
        <Stat label="Upcoming trips" value={bookings ? upcoming.length : '–'} />
        <Stat label="Completed stays" value={bookings ? completed : '–'} />
      </section>

    </GuestAccountLayout>
  );
};

export default GuestDashboard;
