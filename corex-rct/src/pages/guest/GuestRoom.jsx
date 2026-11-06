import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle, ArrowLeft, BedDouble, Building2, CalendarCheck, CheckCircle2, Clock, Download, FileText, Loader2, Minus, Plus, ShieldCheck, Users,
} from 'lucide-react';
import GuestLayout from '../../components/guest/GuestLayout';
import RoomGallery from '../../components/guest/RoomGallery';
import { amenityIcon } from '../../components/guest/amenities';
import {
  ROOM_TYPE_LABELS, addDaysISO, cancellationRule, formatDate, formatMoney, formatTime, nightsBetween, todayISO, useGuest, useStaySearch,
} from '../../components/guest/guestUtils';
import { useAuth } from '../../context/AuthContext';
import { useOrgInfo } from '../../hooks/useOrgInfo';
import { bookingAPI } from '../../services/api';
import { loadRazorpayScript } from '../../utils/razorpay';
import { downloadVoucher } from '../../utils/downloadVoucher';

const dateCls = 'w-full bg-transparent text-sm font-medium text-slate-900 dark:text-white focus:outline-none [color-scheme:light] dark:[color-scheme:dark]';
const labelCls = 'block text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';

const Confirmation = ({ kind, room, org, checkIn, checkOut, total, orgId, bookingId }) => (
  <div className="max-w-lg mx-auto px-4 py-16 text-center">
    {kind === 'requested'
      ? <Clock className="w-14 h-14 text-amber-500 mx-auto" />
      : <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto" />}
    <h1 className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">
      {kind === 'requested' ? 'Booking request sent' : 'You’re booked!'}
    </h1>
    <p className="mt-2 text-slate-600 dark:text-slate-300">
      {kind === 'requested' && `${org?.name || 'The property'} will confirm your booking shortly. ${org?.online_payments
        ? `Once it’s confirmed you can pay ${formatMoney(total)} online from My trips, or at the property.`
        : `You’ll pay ${formatMoney(total)} at the property.`}`}
      {kind === 'confirmed' && `Your room is confirmed. ${org?.online_payments
        ? `Pay ${formatMoney(total)} online from My trips, or at the property.`
        : `You’ll pay ${formatMoney(total)} at the property.`}`}
      {kind === 'paid' && `Your payment of ${formatMoney(total)} was received and your room is confirmed.`}
    </p>
    <div className="mt-6 p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-left">
      <p className="font-semibold text-slate-900 dark:text-white">{room.name}</p>
      <p className="text-sm text-slate-500 dark:text-slate-400">{room.property_name}</p>
      <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">{formatDate(checkIn)} → {formatDate(checkOut)}</p>
      {org?.check_in_time && (
        <p className="text-sm text-slate-500 dark:text-slate-400">Check-in from {formatTime(org.check_in_time)} · check-out by {formatTime(org.check_out_time)}</p>
      )}
    </div>
    <div className="mt-6 flex flex-wrap justify-center gap-3">
      {bookingId && (
        <button type="button" onClick={() => downloadVoucher(bookingId).catch(() => {})}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-green-600 text-green-700 dark:text-green-400 font-semibold hover:bg-green-50 dark:hover:bg-green-500/10">
          <Download className="w-4 h-4" /> Download confirmation
        </button>
      )}
      <Link to="/book/me/trips" className="px-5 py-2.5 rounded-full bg-green-600 hover:bg-green-700 text-white font-semibold">View my trips</Link>
      <Link to={`/book/${orgId}`} className="px-5 py-2.5 rounded-full border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-semibold">Back to rooms</Link>
    </div>
  </div>
);

const GuestRoom = () => {
  const { orgId, roomId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { org, notFound } = useOrgInfo(orgId);
  const { user } = useAuth();
  const { isGuest } = useGuest();
  const { checkIn, checkOut, guests: searchGuests, setStay, query } = useStaySearch();

  const [room, setRoom] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [checking, setChecking] = useState(false);
  const [guests, setGuests] = useState(searchGuests);
  const [requests, setRequests] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [unpaidNotice, setUnpaidNotice] = useState(false);
  const [done, setDone] = useState(null); // 'paid' | 'confirmed' | 'requested'
  const [doneId, setDoneId] = useState(null);
  const cardRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setChecking(true);
    const params = checkIn && checkOut ? { check_in: checkIn, check_out: checkOut } : {};
    bookingAPI.getPublicRoom(orgId, roomId, params)
      .then(({ data }) => { if (!cancelled) setRoom(data); })
      .catch(() => { if (!cancelled) setLoadError('This room isn’t available to book.'); })
      .finally(() => { if (!cancelled) setChecking(false); });
    return () => { cancelled = true; };
  }, [orgId, roomId, checkIn, checkOut]);

  useEffect(() => {
    if (room) setGuests(g => Math.min(Math.max(1, g), room.capacity));
  }, [room]);

  if (notFound || loadError) {
    return (
      <GuestLayout org={org}>
        <div className="max-w-md mx-auto px-4 py-20 text-center">
          <BedDouble className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="font-semibold text-slate-900 dark:text-white">{loadError || 'This booking site isn’t available.'}</p>
          <Link to={`/book/${orgId}`} className="mt-3 inline-block text-sm font-semibold text-green-600">See all rooms</Link>
        </div>
      </GuestLayout>
    );
  }
  if (!room) {
    return (
      <GuestLayout org={org}>
        <div className="px-4 sm:px-6 lg:px-8 py-8 grid gap-8 lg:grid-cols-[1fr_400px]">
          <div className="aspect-[16/9] rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
          <div className="h-96 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
        </div>
      </GuestLayout>
    );
  }

  const nights = nightsBetween(checkIn, checkOut);
  const total = nights * Number(room.price_per_night);
  if (done) {
    return (
      <GuestLayout org={org}>
        <Confirmation kind={done} room={room} org={org} checkIn={checkIn} checkOut={checkOut} total={total} orgId={orgId} bookingId={doneId} />
      </GuestLayout>
    );
  }

  const today = todayISO();
  const accepting = org?.accepting_bookings !== false;
  const unavailable = nights > 0 && room.available === false;
  const otherAccount = !!user && !isGuest;

  const ctaLabel = () => {
    if (!accepting) return 'Not taking bookings';
    if (!nights) return 'Choose your dates';
    if (unavailable) return 'Not available for these dates';
    if (!isGuest) return 'Log in to reserve';
    if (!org?.auto_confirm) return 'Request to book';
    return org?.online_payments ? `Reserve & pay ${formatMoney(total)}` : 'Book now';
  };
  const ctaDisabled = submitting || checking || !accepting || !nights || unavailable;

  const setCheckIn = (value) => setStay({ checkIn: value, checkOut: checkOut && checkOut > value ? checkOut : addDaysISO(value, 1) });

  const pay = async (reservation) => {
    let order;
    try {
      ({ data: order } = await bookingAPI.createOrder(reservation.id));
    } catch (err) {
      if (err.response?.status === 503) { setDone('requested'); return; }
      throw err;
    }
    if (!(await loadRazorpayScript())) {
      setError('Could not open the payment window. Check your connection and try again from My trips.');
      setUnpaidNotice(true);
      return;
    }
    await new Promise((resolve) => {
      const rzp = new window.Razorpay({
        key: order.key_id, amount: order.amount, currency: order.currency, order_id: order.order_id,
        name: org?.name || 'Room booking', description: `${room.name} · ${nights} night${nights > 1 ? 's' : ''}`,
        prefill: { name: `${user.first_name} ${user.last_name}`.trim(), email: user.email, contact: user.phone || undefined },
        theme: { color: '#059669' },
        handler: async (response) => {
          try {
            await bookingAPI.verifyPayment(reservation.id, response);
            setDone('paid');
          } catch (err) {
            // 409 = paid but the room couldn't be held → refunded; the server explains.
            setError(err.response?.data?.error || 'Payment received, but we couldn’t confirm it yet. Check My trips in a minute.');
          }
          resolve();
        },
        modal: { ondismiss: () => { setUnpaidNotice(true); resolve(); } },
      });
      rzp.open();
    });
  };

  const reserve = async () => {
    setError('');
    setUnpaidNotice(false);
    if (!isGuest) {
      navigate(`/book/${orgId}/login?next=${encodeURIComponent(location.pathname + location.search)}`);
      return;
    }
    setSubmitting(true);
    try {
      const { data: reservation } = await bookingAPI.createBooking({
        room: room.id, check_in: checkIn, check_out: checkOut, guests, special_requests: requests,
      });
      setDoneId(reservation.id);
      if (reservation.status === 'CONFIRMED') setDone('confirmed');
      else if (reservation.payment_method === 'AT_PROPERTY') setDone('requested');
      else await pay(reservation);
    } catch (err) {
      const d = err.response?.data || {};
      setError(d.room?.[0] || d.check_in?.[0] || d.check_out?.[0] || d.guests?.[0] || d.error || 'Could not complete this booking. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <GuestLayout org={org}>
      <div className="px-4 sm:px-6 lg:px-8 py-6 pb-28 lg:pb-6">
        <Link to={`/book/${orgId}${query()}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white mb-4">
          <ArrowLeft className="w-4 h-4" /> All rooms
        </Link>

        <div className="grid gap-8 lg:grid-cols-[1fr_400px] items-start">
          {/* Left: room */}
          <div className="min-w-0">
            <RoomGallery images={room.images} alt={room.name} />

            <div className="mt-6">
              <p className="text-sm font-semibold text-green-600 dark:text-green-400">{ROOM_TYPE_LABELS[room.room_type] || 'Room'}</p>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{room.name}</h1>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600 dark:text-slate-300">
                <span className="flex items-center gap-1.5"><Users className="w-4 h-4" />Up to {room.capacity} guest{room.capacity > 1 ? 's' : ''}</span>
                {room.property_name && <span className="flex items-center gap-1.5"><Building2 className="w-4 h-4" />{room.property_name}</span>}
              </div>
            </div>

            {room.description && (
              <section className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">About this room</h2>
                <p className="text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed">{room.description}</p>
              </section>
            )}

            {room.amenities?.length > 0 && (
              <section className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">What this room offers</h2>
                <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {room.amenities.map(a => {
                    const Icon = amenityIcon(a);
                    return (
                      <li key={a} className="flex items-center gap-2.5 text-slate-700 dark:text-slate-200">
                        <Icon className="w-5 h-5 text-slate-500 dark:text-slate-400" />{a}
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {org && (
              <section className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">House rules</h2>
                <div className="grid gap-4 sm:grid-cols-2 text-sm text-slate-600 dark:text-slate-300">
                  <p className="flex gap-2.5"><Clock className="w-5 h-5 text-slate-500 flex-shrink-0" />
                    <span>Check-in from <b className="text-slate-900 dark:text-white">{formatTime(org.check_in_time)}</b><br />Check-out by <b className="text-slate-900 dark:text-white">{formatTime(org.check_out_time)}</b></span>
                  </p>
                  <p className="flex gap-2.5"><FileText className="w-5 h-5 text-slate-500 flex-shrink-0" />
                    <span className="whitespace-pre-line"><b className="text-slate-900 dark:text-white">{cancellationRule(org.free_cancellation_hours)}</b>{org.cancellation_policy ? `\n${org.cancellation_policy}` : ''}</span>
                  </p>
                </div>
              </section>
            )}
          </div>

          {/* Right: booking card */}
          <aside ref={cardRef} className="lg:sticky lg:top-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl p-5 scroll-mt-24">
            <p>
              <span className="text-2xl font-bold text-slate-900 dark:text-white">{formatMoney(room.price_per_night)}</span>
              <span className="text-slate-500 dark:text-slate-400"> / night</span>
            </p>

            <div className="mt-4 rounded-xl border border-slate-300 dark:border-slate-600 overflow-hidden">
              <div className="grid grid-cols-2 divide-x divide-slate-300 dark:divide-slate-600">
                <label className="px-3 py-2.5 cursor-pointer">
                  <span className={labelCls}>Check-in</span>
                  <input type="date" min={today} value={checkIn} onChange={e => setCheckIn(e.target.value)} className={dateCls} aria-label="Check-in date" />
                </label>
                <label className="px-3 py-2.5 cursor-pointer">
                  <span className={labelCls}>Check-out</span>
                  <input type="date" min={checkIn ? addDaysISO(checkIn, 1) : addDaysISO(today, 1)} value={checkOut}
                    onChange={e => setStay({ checkOut: e.target.value })} className={dateCls} aria-label="Check-out date" />
                </label>
              </div>
              <div className="px-3 py-2.5 border-t border-slate-300 dark:border-slate-600 flex items-center justify-between">
                <div>
                  <span className={labelCls}>Guests</span>
                  <span className="text-sm font-medium text-slate-900 dark:text-white">{guests} guest{guests > 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" aria-label="Fewer guests" disabled={guests <= 1} onClick={() => setGuests(g => g - 1)}
                    className="w-8 h-8 rounded-full border border-slate-300 dark:border-slate-600 flex items-center justify-center disabled:opacity-30 text-slate-600 dark:text-slate-300"><Minus className="w-4 h-4" /></button>
                  <button type="button" aria-label="More guests" disabled={guests >= room.capacity} onClick={() => setGuests(g => g + 1)}
                    className="w-8 h-8 rounded-full border border-slate-300 dark:border-slate-600 flex items-center justify-center disabled:opacity-30 text-slate-600 dark:text-slate-300"><Plus className="w-4 h-4" /></button>
                </div>
              </div>
            </div>

            {nights > 0 && (
              <p className={`mt-3 text-sm flex items-center gap-1.5 ${unavailable ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>
                {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : unavailable ? <AlertCircle className="w-4 h-4" /> : <CalendarCheck className="w-4 h-4" />}
                {checking ? 'Checking availability…' : unavailable ? 'Already booked for these dates — try other dates.' : 'Available for your dates'}
              </p>
            )}

            {isGuest && nights > 0 && !unavailable && (
              <label className="block mt-3">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Special requests (optional)</span>
                <textarea rows={2} value={requests} onChange={e => setRequests(e.target.value)} placeholder="Early check-in, extra bed…"
                  className="mt-1 w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500" />
              </label>
            )}

            {error && (
              <div className="mt-3 p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-sm text-red-700 dark:text-red-300 flex gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />{error}
              </div>
            )}
            {unpaidNotice && (
              <div className="mt-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-sm text-amber-800 dark:text-amber-300">
                Your reservation is saved but not paid. It holds the room for 15 minutes.{' '}
                <Link to="/book/me/trips" className="font-semibold underline">Pay from My trips</Link>
              </div>
            )}

            <button type="button" onClick={reserve} disabled={ctaDisabled}
              className="mt-4 w-full py-3.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? 'Processing…' : ctaLabel()}
            </button>
            {otherAccount && (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 text-center">You’re signed in with a staff account. Log in as a guest to book.</p>
            )}
            {isGuest && nights > 0 && !unavailable && (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 text-center">
                {!org?.auto_confirm
                  ? 'No payment now — the property confirms your request first.'
                  : org?.online_payments ? 'You won’t be charged until you complete payment.' : 'No payment now — pay at the property.'}
              </p>
            )}

            {nights > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 space-y-2 text-sm">
                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                  <span>{formatMoney(room.price_per_night)} × {nights} night{nights > 1 ? 's' : ''}</span>
                  <span>{formatMoney(total)}</span>
                </div>
                <div className="flex justify-between font-semibold text-slate-900 dark:text-white text-base">
                  <span>Total</span><span>{formatMoney(total)}</span>
                </div>
              </div>
            )}
            {org && <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400"><CalendarCheck className="w-4 h-4" />{cancellationRule(org.free_cancellation_hours)}</p>}
            <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-400"><ShieldCheck className="w-4 h-4" />Book direct with {org?.name || 'the property'} — no booking fees.</p>
          </aside>
        </div>
      </div>

      {/* Mobile: price + reserve bar */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-slate-900 dark:text-white">{nights > 0 ? formatMoney(total) : formatMoney(room.price_per_night)}
            <span className="font-normal text-sm text-slate-500"> {nights > 0 ? `· ${nights} night${nights > 1 ? 's' : ''}` : '/ night'}</span>
          </p>
          {nights > 0 && <p className="text-xs text-slate-500 truncate">{formatDate(checkIn)} – {formatDate(checkOut)}</p>}
        </div>
        <button type="button"
          onClick={() => (nights && !unavailable && accepting ? reserve() : cardRef.current?.scrollIntoView({ behavior: 'smooth' }))}
          disabled={submitting}
          className="px-5 py-3 rounded-xl bg-green-600 text-white font-semibold whitespace-nowrap disabled:opacity-50">
          {nights && !unavailable && accepting ? (isGuest ? 'Reserve' : 'Log in to reserve') : 'Check dates'}
        </button>
      </div>
    </GuestLayout>
  );
};

export default GuestRoom;
