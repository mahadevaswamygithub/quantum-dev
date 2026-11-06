import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, BedDouble, CalendarX, Download, History, Loader2, Phone, Star } from 'lucide-react';
import GuestAccountLayout from '../../components/guest/GuestAccountLayout';
import BookingHistoryModal from '../../components/BookingHistoryModal';
import RateStayModal from '../../components/guest/RateStayModal';
import Stars from '../../components/common/Stars';
import { formatDate, formatDateTime, formatMoney, formatTime, todayISO, useGuest } from '../../components/guest/guestUtils';
import { bookingAPI } from '../../services/api';
import { loadRazorpayScript } from '../../utils/razorpay';
import { downloadVoucher } from '../../utils/downloadVoucher';

const STATUS = {
  PENDING: { label: 'Payment pending', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300' },
  AWAITING: { label: 'Awaiting confirmation', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300' },
  CONFIRMED: { label: 'Confirmed', cls: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300' },
  CHECKED_IN: { label: 'Checked in', cls: 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300' },
  CHECKED_OUT: { label: 'Completed', cls: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300' },
  CANCELLED: { label: 'Cancelled', cls: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300' },
};
const statusOf = (b) => (b.status === 'PENDING' && b.payment_method === 'AT_PROPERTY' ? STATUS.AWAITING : STATUS[b.status] || { label: b.status, cls: '' });

const CANCEL_REASON = {
  EXPIRED: 'Not paid in time', CUSTOMER: 'Cancelled by you', STAFF: 'Cancelled by the property',
  REFUNDED: 'Refunded', UNAVAILABLE: 'Room became unavailable — refunded',
};

const TABS = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'past', label: 'Past' },
  { id: 'cancelled', label: 'Cancelled' },
];

const MyTrips = () => {
  const { user } = useGuest();
  const [bookings, setBookings] = useState(null);
  const [tab, setTab] = useState('upcoming');
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [historyId, setHistoryId] = useState(null);
  const [rateFor, setRateFor] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await bookingAPI.getBookings();
      setBookings(data || []);
    } catch {
      setError('Could not load your trips. Please refresh.');
      setBookings([]);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const groups = useMemo(() => {
    const today = todayISO();
    const all = bookings || [];
    return {
      upcoming: all.filter(b => ['PENDING', 'CONFIRMED', 'CHECKED_IN'].includes(b.status) && b.check_out >= today)
        .sort((a, b) => a.check_in.localeCompare(b.check_in)),
      past: all.filter(b => b.status === 'CHECKED_OUT' || (['CONFIRMED', 'CHECKED_IN'].includes(b.status) && b.check_out < today)),
      cancelled: all.filter(b => b.status === 'CANCELLED'),
    };
  }, [bookings]);

  const cancel = async (b) => {
    const refundNote = b.is_paid ? `\n\nYour payment of ${formatMoney(b.total_amount)} will be refunded.` : '';
    if (!window.confirm(`Cancel your stay at ${b.organization_name} – ${b.room_detail?.name} (${formatDate(b.check_in)} – ${formatDate(b.check_out)})?${refundNote}`)) return;
    setBusyId(b.id); setError('');
    try { await bookingAPI.cancelBooking(b.id); await load(); }
    catch (err) { setError(err.response?.data?.error || 'Could not cancel this booking.'); }
    finally { setBusyId(null); }
  };

  const payNow = async (b) => {
    setBusyId(b.id); setError('');
    try {
      const { data: order } = await bookingAPI.createOrder(b.id);
      if (!(await loadRazorpayScript())) { setError('Could not open the payment window.'); setBusyId(null); return; }
      const rzp = new window.Razorpay({
        key: order.key_id, amount: order.amount, currency: order.currency, order_id: order.order_id,
        name: b.organization_name || 'Room booking', description: b.room_detail?.name,
        prefill: { name: `${user.first_name} ${user.last_name}`.trim(), email: user.email, contact: user.phone || undefined },
        theme: { color: '#059669' },
        handler: async (response) => {
          try { await bookingAPI.verifyPayment(b.id, response); }
          catch (err) { setError(err.response?.data?.error || 'Payment received, but confirmation is delayed. Refresh in a minute.'); }
          await load();
          setBusyId(null);
        },
        modal: { ondismiss: () => setBusyId(null) },
      });
      rzp.open();
    } catch (err) {
      setError(err.response?.data?.error || 'Payment isn’t available right now.');
      await load();
      setBusyId(null);
    }
  };

  const list = groups[tab];

  return (
    <GuestAccountLayout>
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">My trips</h1>
        <p className="text-slate-500 dark:text-slate-400">All your bookings, at every property.</p>

        <div role="tablist" className="mt-6 flex gap-6 border-b border-slate-200 dark:border-slate-800">
          {TABS.map(t => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} type="button" onClick={() => setTab(t.id)}
              className={`pb-3 -mb-px text-sm font-semibold border-b-2 transition-colors ${
                tab === t.id ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}>
              {t.label}{bookings && groups[t.id].length > 0 && <span className="ml-1.5 text-slate-400 font-normal">{groups[t.id].length}</span>}
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-sm text-red-700 dark:text-red-300 flex gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />{error}
          </div>
        )}

        <div className="mt-6 space-y-4">
          {!bookings ? (
            [0, 1].map(i => <div key={i} className="h-36 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />)
          ) : list.length === 0 ? (
            <div className="flex flex-col items-center text-center py-14 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
              <CalendarX className="w-10 h-10 text-slate-300 mb-3" />
              <p className="font-semibold text-slate-900 dark:text-white">
                {tab === 'upcoming' ? 'No upcoming trips' : tab === 'past' ? 'No past trips yet' : 'No cancelled bookings'}
              </p>
              {tab === 'upcoming' && (
                <Link to="/book" className="mt-3 px-5 py-2.5 rounded-full bg-green-600 hover:bg-green-700 text-white text-sm font-semibold">Find a room</Link>
              )}
            </div>
          ) : list.map(b => {
            const s = statusOf(b);
            const busy = busyId === b.id;
            const canPay = b.can_pay_online;
            const active = ['PENDING', 'CONFIRMED'].includes(b.status);
            const canCancel = active && b.can_cancel;
            return (
              <article key={b.id} className="flex flex-col sm:flex-row overflow-hidden rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <div className="sm:w-48 aspect-[16/9] sm:aspect-auto bg-slate-100 dark:bg-slate-700 flex-shrink-0">
                  {b.room_detail?.primary_image
                    ? <img src={b.room_detail.primary_image} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-slate-400"><BedDouble className="w-8 h-8" /></div>}
                </div>
                <div className="flex-1 p-4 sm:p-5 min-w-0">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link to={`/book/${b.organization}`} className="text-xs font-semibold uppercase tracking-wide text-green-600 dark:text-green-400 hover:underline">{b.organization_name}</Link>
                      <h3 className="font-semibold text-slate-900 dark:text-white">{b.room_detail?.name}</h3>
                      {b.property_name && <p className="text-sm text-slate-500 dark:text-slate-400">{b.property_name}</p>}
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${s.cls}`}>{s.label}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                    <div><p className="text-xs text-slate-500 dark:text-slate-400">Check-in</p><p className="font-medium text-slate-900 dark:text-white">{formatDate(b.check_in)}</p>
                      {b.check_in_time && <p className="text-xs text-slate-500">from {formatTime(b.check_in_time)}</p>}</div>
                    <div><p className="text-xs text-slate-500 dark:text-slate-400">Check-out</p><p className="font-medium text-slate-900 dark:text-white">{formatDate(b.check_out)}</p>
                      {b.check_out_time && <p className="text-xs text-slate-500">by {formatTime(b.check_out_time)}</p>}</div>
                    <div><p className="text-xs text-slate-500 dark:text-slate-400">Total · {b.nights} night{b.nights > 1 ? 's' : ''}</p><p className="font-medium text-slate-900 dark:text-white">{formatMoney(b.total_amount)}</p>
                      <p className="text-xs text-slate-500">{b.is_paid ? 'Paid online' : b.payment_status === 'REFUNDED' ? 'Refunded' : b.can_pay_online ? (b.status === 'CONFIRMED' ? 'Pay online or at property' : 'Not paid') : 'Pay at property'}</p></div>
                  </div>
                  {b.status === 'PENDING' && b.payment_method === 'AT_PROPERTY' && (
                    <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">Waiting for {b.organization_name} to confirm. You’ll be able to pay once it’s confirmed.</p>
                  )}
                  {b.status === 'CONFIRMED' && b.can_pay_online && (
                    <p className="mt-2 text-xs text-green-700 dark:text-green-300">Confirmed! Pay now to skip paying at the front desk.</p>
                  )}
                  {b.status === 'CONFIRMED' && (canCancel ? (
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Free cancellation until {formatDateTime(b.cancellation_deadline)}{b.is_paid ? ' — full refund' : ''}.</p>
                  ) : (
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      The free cancellation window has passed. To cancel, contact {b.organization_name}
                      {b.organization_phone ? <> on <a href={`tel:${b.organization_phone}`} className="font-medium underline">{b.organization_phone}</a></> : ''}.
                    </p>
                  ))}
                  {b.review && (
                    <div className="mt-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-700/40">
                      <p className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">Your review <Stars value={b.review.rating} size="w-3.5 h-3.5" /></p>
                      {b.review.comment && <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{b.review.comment}</p>}
                      {b.review.reply && <p className="mt-2 pl-2 border-l-2 border-green-500 text-sm text-slate-600 dark:text-slate-300"><b>{b.organization_name}:</b> {b.review.reply}</p>}
                    </div>
                  )}
                  {b.status === 'CANCELLED' && b.cancel_reason && (
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{CANCEL_REASON[b.cancel_reason] || 'Cancelled'}</p>
                  )}
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {canPay && (
                      <button type="button" onClick={() => payNow(b)} disabled={busy}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold disabled:opacity-50">
                        {busy && <Loader2 className="w-4 h-4 animate-spin" />} Pay {formatMoney(b.total_amount)}
                      </button>
                    )}
                    {canCancel && (
                      <button type="button" onClick={() => cancel(b)} disabled={busy}
                        className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50">
                        Cancel booking
                      </button>
                    )}
                    {b.organization_phone && ['CONFIRMED', 'CHECKED_IN', 'PENDING'].includes(b.status) && (
                      <a href={`tel:${b.organization_phone}`} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white">
                        <Phone className="w-4 h-4" /> Call property
                      </a>
                    )}
                    {b.can_review && (
                      <button type="button" onClick={() => setRateFor(b)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-500 text-amber-950 text-sm font-semibold">
                        <Star className="w-4 h-4" /> Rate your stay
                      </button>
                    )}
                    <button type="button"
                      onClick={() => downloadVoucher(b.id).catch(() => setError('Could not download the confirmation. Please try again.'))}
                      className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-green-700 dark:text-green-400 hover:text-green-800">
                      <Download className="w-4 h-4" /> Download
                    </button>
                    <button type="button" onClick={() => setHistoryId(b.id)}
                      className=" inline-flex items-center gap-1.5 px-3 py-2 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
                      <History className="w-4 h-4" /> Timeline
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
      {historyId && <BookingHistoryModal bookingId={historyId} onClose={() => setHistoryId(null)} />}
      <RateStayModal booking={rateFor} onClose={() => setRateFor(null)} onSaved={load} />
    </GuestAccountLayout>
  );
};

export default MyTrips;
