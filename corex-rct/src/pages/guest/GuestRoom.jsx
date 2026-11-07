import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle, BadgeCheck, BedDouble, Building2, CalendarCheck, CalendarDays, CheckCircle2, ChevronRight, Clock, CreditCard, Download,
  FileText, Loader2, Mail, MapPin, Minus, Phone, Plus, Share2, ShieldCheck, Star, Users, Zap,
} from 'lucide-react';
import GuestLayout from '../../components/guest/GuestLayout';
import PhotoMosaic from '../../components/guest/PhotoMosaic';
import DateRangeCalendar from '../../components/guest/DateRangeCalendar';
import RoomCard from '../../components/guest/RoomCard';
import Stars from '../../components/common/Stars';
import { amenityIcon } from '../../components/guest/amenities';
import {
  ROOM_TYPE_LABELS, cancellationRule, formatDate, formatMoney, formatTime, nightsBetween, useGuest, useStaySearch,
} from '../../components/guest/guestUtils';
import { BTN_PRIMARY, CONTAINER, EYEBROW } from '../../components/guest/site';
import { useAuth } from '../../context/AuthContext';
import { useOrgInfo } from '../../hooks/useOrgInfo';
import { bookingAPI } from '../../services/api';
import { loadRazorpayScript } from '../../utils/razorpay';
import { downloadVoucher } from '../../utils/downloadVoucher';

const labelCls = 'block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400';

/** A titled white card section on the room page. */
const Section = ({ eyebrow, title, children, id }) => (
  <section id={id} className="rounded-3xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/70 p-6 sm:p-7 scroll-mt-24">
    {eyebrow && <p className={EYEBROW}>{eyebrow}</p>}
    <h2 className="mt-1 mb-4 text-xl font-bold text-slate-900 dark:text-white">{title}</h2>
    {children}
  </section>
);

const Fact = ({ icon: Icon, label, value }) => (
  <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700/60">
    <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-400/15 to-blue-500/15 text-green-600 dark:text-green-400 flex items-center justify-center flex-shrink-0"><Icon className="w-5 h-5" /></span>
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{value}</p>
    </div>
  </div>
);

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
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-brand-500 text-brand-700 dark:text-brand-400 font-semibold hover:bg-brand-50 dark:hover:bg-brand-500/10">
          <Download className="w-4 h-4" /> Download confirmation
        </button>
      )}
      <Link to="/book/me/trips" className="px-5 py-2.5 rounded-full bg-brand-500 hover:bg-brand-600 text-white font-semibold">View my trips</Link>
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
  const [reviews, setReviews] = useState([]);
  const [otherRooms, setOtherRooms] = useState([]);
  const [datesOpen, setDatesOpen] = useState(false);
  const [draftDates, setDraftDates] = useState({ checkIn, checkOut });
  const [shared, setShared] = useState('');
  const datesRef = useRef(null);

  useEffect(() => { setDraftDates({ checkIn, checkOut }); }, [checkIn, checkOut]);
  useEffect(() => {
    if (!datesOpen) return undefined;
    const close = (e) => { if (datesRef.current && !datesRef.current.contains(e.target)) setDatesOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setDatesOpen(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc); };
  }, [datesOpen]);

  useEffect(() => {
    bookingAPI.getPublicReviews(orgId).then(({ data }) => setReviews(data || [])).catch(() => setReviews([]));
  }, [orgId]);
  useEffect(() => {
    let cancelled = false;
    const params = checkIn && checkOut ? { check_in: checkIn, check_out: checkOut } : {};
    bookingAPI.getPublicRooms(orgId, params)
      .then(({ data }) => { if (!cancelled) setOtherRooms((data || []).filter(r => String(r.id) !== String(roomId)).slice(0, 3)); })
      .catch(() => { if (!cancelled) setOtherRooms([]); });
    return () => { cancelled = true; };
  }, [orgId, roomId, checkIn, checkOut]);

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
          <Link to={`/book/${orgId}`} className="mt-3 inline-block text-sm font-semibold text-brand-700">See all rooms</Link>
        </div>
      </GuestLayout>
    );
  }
  if (!room) {
    return (
      <GuestLayout org={org}>
        <div className={`${CONTAINER} py-8 grid gap-8 lg:grid-cols-[1fr_400px]`}>
          <div className="h-72 sm:h-[440px] rounded-3xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
          <div className="h-96 rounded-3xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
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

  const pickDates = (r) => {
    setDraftDates(r);
    if (r.checkIn && r.checkOut) setStay(r);
  };
  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) { await navigator.share({ title: `${room.name} · ${org?.name || ''}`, url }); return; }
      await navigator.clipboard.writeText(url);
      setShared('Link copied');
    } catch { setShared(''); }
    setTimeout(() => setShared(''), 2000);
  };
  const photos = [...(room.images || []).map(i => i.image), org?.cover_image].filter((v, i, a) => v && a.indexOf(v) === i);
  const address = room.property_address || org?.address || '';
  const mapUrl = address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${org?.name || ''} ${address}`)}` : null;

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
      <div className={`${CONTAINER} py-6 pb-28 lg:pb-10`}>
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-sm text-slate-500 dark:text-slate-400 mb-4">
          <Link to="/book" className="hover:text-brand-700 dark:hover:text-brand-400">Home</Link><ChevronRight className="w-4 h-4" />
          <Link to={`/book/stays${query()}`} className="hover:text-brand-700 dark:hover:text-brand-400">Stays</Link><ChevronRight className="w-4 h-4" />
          <Link to={`/book/${orgId}${query()}`} className="hover:text-brand-700 dark:hover:text-brand-400">{org?.name || 'Property'}</Link><ChevronRight className="w-4 h-4" />
          <span className="font-medium text-slate-800 dark:text-slate-200">{room.name}</span>
        </nav>

        <PhotoMosaic photos={photos} alt={room.name} />

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px] items-start">
          {/* Left: everything about the room and the property */}
          <div className="min-w-0 space-y-6">
            {/* Title card */}
            <section className="rounded-3xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/70 p-6 sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 text-xs font-bold uppercase tracking-wide">{ROOM_TYPE_LABELS[room.room_type] || 'Room'}</span>
                    {org?.rating_count > 0 && org.rating_avg >= 4.5 && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs font-bold uppercase tracking-wide"><Star className="w-3 h-3 fill-current" />Guest favourite</span>
                    )}
                    {org?.auto_confirm && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 text-xs font-bold uppercase tracking-wide"><Zap className="w-3 h-3" />Instant confirmation</span>
                    )}
                  </div>
                  <h1 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                    {room.name}<span className="text-slate-400 dark:text-slate-500 font-bold"> · {org?.name}</span>
                  </h1>
                  <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-600 dark:text-slate-300">
                    {address && <span className="inline-flex items-center gap-1.5"><MapPin className="w-4 h-4 text-green-600 dark:text-green-400" />{address}</span>}
                    {mapUrl && <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-600 dark:text-blue-400 hover:underline">View on map</a>}
                    <button type="button" onClick={share} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-600 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700">
                      <Share2 className="w-3.5 h-3.5" />{shared || 'Share'}
                    </button>
                  </div>
                </div>
                <a href="#reviews" className="flex items-center gap-3 p-3 pr-4 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-green-400 transition-colors">
                  <span className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500 to-blue-500 text-white flex flex-col items-center justify-center font-extrabold leading-none">
                    {org?.rating_count > 0 ? <>{org.rating_avg}<Star className="mt-1 w-3 h-3 fill-white" /></> : <span className="text-sm">New</span>}
                  </span>
                  <span>
                    <span className="block font-bold text-slate-900 dark:text-white">{org?.rating_count > 0 ? (org.rating_avg >= 4.5 ? 'Excellent' : org.rating_avg >= 4 ? 'Very good' : org.rating_avg >= 3 ? 'Good' : 'Rated') : 'No reviews yet'}</span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">{org?.rating_count > 0 ? `${org.rating_count} guest review${org.rating_count === 1 ? '' : 's'}` : 'Be the first to stay'}</span>
                  </span>
                </a>
              </div>

              <div className="mt-6 grid gap-3 grid-cols-2 xl:grid-cols-4">
                <Fact icon={Users} label="Sleeps" value={`Up to ${room.capacity} guest${room.capacity > 1 ? 's' : ''}`} />
                <Fact icon={BedDouble} label="Room type" value={ROOM_TYPE_LABELS[room.room_type] || 'Room'} />
                {room.property_name ? <Fact icon={Building2} label="Building" value={room.property_name} /> : <Fact icon={Building2} label="Property" value={org?.name || '-'} />}
                {org?.check_in_time && <Fact icon={Clock} label="Check-in" value={`From ${formatTime(org.check_in_time)}`} />}
              </div>
            </section>

            {(room.description || room.property_description) && (
              <Section eyebrow="Overview" title="About this stay">
                {room.description && <p className="text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed">{room.description}</p>}
                {room.property_description && (
                  <div className={room.description ? 'mt-5 pt-5 border-t border-slate-100 dark:border-slate-700' : ''}>
                    <p className="mb-1.5 text-sm font-bold text-slate-900 dark:text-white">About {room.property_name || org?.name}</p>
                    <p className="text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed">{room.property_description}</p>
                  </div>
                )}
              </Section>
            )}

            {room.amenities?.length > 0 && (
              <Section eyebrow="Amenities" title="What this room offers">
                <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {room.amenities.map(a => {
                    const Icon = amenityIcon(a);
                    return (
                      <li key={a} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700/60 text-sm font-medium text-slate-700 dark:text-slate-200">
                        <span className="w-9 h-9 rounded-xl bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center text-green-600 dark:text-green-400 flex-shrink-0"><Icon className="w-[18px] h-[18px]" /></span>
                        <span className="truncate">{a}</span>
                      </li>
                    );
                  })}
                </ul>
              </Section>
            )}

            {org && (
              <Section eyebrow="Before you book" title="Policies & house rules">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex gap-3">
                    <Clock className="w-5 h-5 mt-0.5 text-green-600 dark:text-green-400 flex-shrink-0" />
                    <div className="text-sm text-slate-600 dark:text-slate-300">
                      <p className="font-bold text-slate-900 dark:text-white">Check-in & check-out</p>
                      <p>Check-in from {formatTime(org.check_in_time)}</p>
                      <p>Check-out by {formatTime(org.check_out_time)}</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <FileText className="w-5 h-5 mt-0.5 text-green-600 dark:text-green-400 flex-shrink-0" />
                    <div className="text-sm text-slate-600 dark:text-slate-300">
                      <p className="font-bold text-slate-900 dark:text-white">Cancellation</p>
                      <p>{cancellationRule(org.free_cancellation_hours)}</p>
                      {org.cancellation_policy && <p className="mt-1 whitespace-pre-line">{org.cancellation_policy}</p>}
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <CreditCard className="w-5 h-5 mt-0.5 text-green-600 dark:text-green-400 flex-shrink-0" />
                    <div className="text-sm text-slate-600 dark:text-slate-300">
                      <p className="font-bold text-slate-900 dark:text-white">Payment</p>
                      <p>{org.online_payments ? 'Pay securely online, or at the property.' : 'Pay at the property when you arrive.'}</p>
                      <p>{org.auto_confirm ? 'Your booking is confirmed instantly.' : 'The property confirms each request first.'}</p>
                    </div>
                  </div>
                  {(org.contact_phone || org.contact_email) && (
                    <div className="flex gap-3">
                      <Phone className="w-5 h-5 mt-0.5 text-green-600 dark:text-green-400 flex-shrink-0" />
                      <div className="text-sm text-slate-600 dark:text-slate-300">
                        <p className="font-bold text-slate-900 dark:text-white">Need help?</p>
                        {org.contact_phone && <a href={`tel:${org.contact_phone}`} className="block hover:underline">{org.contact_phone}</a>}
                        {org.contact_email && <a href={`mailto:${org.contact_email}`} className="flex items-center gap-1 hover:underline break-all"><Mail className="w-3.5 h-3.5" />{org.contact_email}</a>}
                      </div>
                    </div>
                  )}
                </div>
              </Section>
            )}

            <Section id="reviews" eyebrow="Guest reviews" title={org?.rating_count > 0 ? `${org.rating_avg} out of 5 · ${org.rating_count} review${org.rating_count === 1 ? '' : 's'}` : 'Reviews'}>
              {reviews.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">No reviews yet - guests can rate their stay after check-out.</p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {reviews.slice(0, 4).map(r => (
                    <article key={r.id} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700/60">
                      <div className="flex items-center gap-3">
                        <span className="w-9 h-9 rounded-full bg-gradient-to-br from-green-400 to-blue-500 text-white text-sm font-bold flex items-center justify-center">{(r.guest || 'G')[0]}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">{r.guest}</p>
                          <p className="text-xs text-slate-400">{new Date(r.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</p>
                        </div>
                        <span className="ml-auto"><Stars value={r.rating} size="w-3.5 h-3.5" /></span>
                      </div>
                      {r.comment && <p className="mt-3 text-sm text-slate-700 dark:text-slate-200 whitespace-pre-line">{r.comment}</p>}
                      {r.reply && <p className="mt-3 pl-3 border-l-2 border-green-500 text-sm text-slate-600 dark:text-slate-300"><b className="text-slate-900 dark:text-white">Response from {org?.name}:</b> {r.reply}</p>}
                    </article>
                  ))}
                </div>
              )}
            </Section>
          </div>

          {/* Right: booking card */}
          <aside ref={cardRef} className="lg:sticky lg:top-24 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl shadow-slate-900/5 overflow-visible scroll-mt-24">
            <div className="p-6 rounded-t-3xl bg-gradient-to-br from-slate-900 to-slate-800 text-white">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-green-300">Your stay</p>
              <p className="mt-1">
                <span className="text-3xl font-extrabold">{formatMoney(room.price_per_night)}</span>
                <span className="text-white/60"> / night</span>
              </p>
              {org?.rating_count > 0 && (
                <p className="mt-1 flex items-center gap-1 text-sm text-white/70"><Star className="w-4 h-4 fill-amber-400 text-amber-400" />{org.rating_avg} · {org.rating_count} review{org.rating_count === 1 ? '' : 's'}</p>
              )}
            </div>

            <div className="p-6">
              <div ref={datesRef} className="relative rounded-2xl border border-slate-200 dark:border-slate-600">
                <button type="button" onClick={() => setDatesOpen(o => !o)} aria-expanded={datesOpen}
                  className={`w-full grid grid-cols-2 divide-x divide-slate-200 dark:divide-slate-600 text-left rounded-t-2xl transition-colors ${datesOpen ? 'bg-green-50/60 dark:bg-green-500/5' : 'hover:bg-slate-50 dark:hover:bg-slate-700/40'}`}>
                  <span className="px-4 py-3">
                    <span className={labelCls}>Check-in</span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-white"><CalendarDays className="w-4 h-4 text-green-600 dark:text-green-400" />{draftDates.checkIn ? formatDate(draftDates.checkIn) : <span className="text-slate-400 font-medium">Add date</span>}</span>
                  </span>
                  <span className="px-4 py-3">
                    <span className={labelCls}>Check-out</span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-white"><CalendarDays className="w-4 h-4 text-green-600 dark:text-green-400" />{draftDates.checkOut ? formatDate(draftDates.checkOut) : <span className="text-slate-400 font-medium">Add date</span>}</span>
                  </span>
                </button>
                {datesOpen && (
                  <div className="absolute z-40 top-full right-0 mt-2 p-5 w-[min(calc(100vw-2rem),21rem)] sm:w-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-2xl animate-pop-in motion-reduce:animate-none origin-top-right">
                    <DateRangeCalendar checkIn={draftDates.checkIn} checkOut={draftDates.checkOut} onChange={pickDates} onDone={() => setDatesOpen(false)} />
                  </div>
                )}
                <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-600 flex items-center justify-between">
                  <div>
                    <span className={labelCls}>Guests</span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-white"><Users className="w-4 h-4 text-green-600 dark:text-green-400" />{guests} guest{guests > 1 ? 's' : ''}<span className="font-normal text-slate-400">· max {room.capacity}</span></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" aria-label="Fewer guests" disabled={guests <= 1} onClick={() => setGuests(g => g - 1)}
                      className="w-8 h-8 rounded-full border border-slate-300 dark:border-slate-600 flex items-center justify-center disabled:opacity-30 text-slate-600 dark:text-slate-300 hover:border-green-500"><Minus className="w-4 h-4" /></button>
                    <button type="button" aria-label="More guests" disabled={guests >= room.capacity} onClick={() => setGuests(g => g + 1)}
                      className="w-8 h-8 rounded-full border border-slate-300 dark:border-slate-600 flex items-center justify-center disabled:opacity-30 text-slate-600 dark:text-slate-300 hover:border-green-500"><Plus className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>

              {nights > 0 && (
                <p className={`mt-3 text-sm font-medium flex items-center gap-1.5 ${unavailable ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>
                  {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : unavailable ? <AlertCircle className="w-4 h-4" /> : <CalendarCheck className="w-4 h-4" />}
                  {checking ? 'Checking availability…' : unavailable ? 'Already booked for these dates - try other dates.' : 'Available for your dates'}
                </p>
              )}

              {nights > 0 && (
                <div className="mt-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 space-y-2 text-sm">
                  <div className="flex justify-between text-slate-600 dark:text-slate-300">
                    <span>{formatMoney(room.price_per_night)} × {nights} night{nights > 1 ? 's' : ''}</span>
                    <span>{formatMoney(total)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-300">
                    <span>Booking fee</span><span className="font-semibold text-green-600 dark:text-green-400">Free</span>
                  </div>
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between font-extrabold text-slate-900 dark:text-white text-lg">
                    <span>Total</span><span>{formatMoney(total)}</span>
                  </div>
                </div>
              )}

              {isGuest && nights > 0 && !unavailable && (
                <label className="block mt-4">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Special requests (optional)</span>
                  <textarea rows={2} value={requests} onChange={e => setRequests(e.target.value)} placeholder="Early check-in, extra bed…"
                    className="mt-1 w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500/40 focus:border-green-500" />
                </label>
              )}

              {error && (
                <div className="mt-3 p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-sm text-red-700 dark:text-red-300 flex gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />{error}
                </div>
              )}
              {unpaidNotice && (
                <div className="mt-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-sm text-amber-800 dark:text-amber-300">
                  Your reservation is saved but not paid. It holds the room for 15 minutes.{' '}
                  <Link to="/book/me/trips" className="font-semibold underline">Pay from My trips</Link>
                </div>
              )}

              <button type="button" onClick={!nights ? () => setDatesOpen(true) : reserve} disabled={nights ? ctaDisabled : !accepting}
                className={`${BTN_PRIMARY} mt-4 w-full h-12 text-base shadow-lg`}>
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {submitting ? 'Processing…' : ctaLabel()}
              </button>
              {otherAccount && (
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 text-center">You’re signed in with a staff account. Log in as a guest to book.</p>
              )}
              {isGuest && nights > 0 && !unavailable && (
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 text-center">
                  {!org?.auto_confirm
                    ? 'No payment now - the property confirms your request first.'
                    : org?.online_payments ? 'You won’t be charged until you complete payment.' : 'No payment now - pay at the property.'}
                </p>
              )}

              <ul className="mt-5 pt-5 border-t border-slate-100 dark:border-slate-700 space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
                {org && <li className="flex items-center gap-2"><CalendarCheck className="w-4 h-4 text-green-600 dark:text-green-400" />{cancellationRule(org.free_cancellation_hours)}</li>}
                <li className="flex items-center gap-2"><BadgeCheck className="w-4 h-4 text-green-600 dark:text-green-400" />Listed and run by {org?.name || 'the property'}</li>
                <li className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-green-600 dark:text-green-400" />No booking fees · secure payment</li>
              </ul>
            </div>
          </aside>
        </div>

        {otherRooms.length > 0 && (
          <section className="mt-12">
            <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
              <div>
                <p className={EYEBROW}>More at {org?.name}</p>
                <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">Other rooms you might like</h2>
              </div>
              <Link to={`/book/${orgId}${query()}`} className="text-sm font-semibold text-green-700 dark:text-green-400 hover:underline">See all rooms</Link>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {otherRooms.map(r => <RoomCard key={r.id} room={r} checkIn={checkIn} checkOut={checkOut} to={`/book/${orgId}/rooms/${r.id}${query()}`} />)}
            </div>
          </section>
        )}
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
          className="px-5 py-3 rounded-xl bg-brand-500 text-white font-semibold whitespace-nowrap disabled:opacity-50">
          {nights && !unavailable && accepting ? (isGuest ? 'Reserve' : 'Log in to reserve') : 'Check dates'}
        </button>
      </div>
    </GuestLayout>
  );
};

export default GuestRoom;
