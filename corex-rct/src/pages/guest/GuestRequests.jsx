import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Clock, FileClock, MessageSquareX } from 'lucide-react';
import GuestAccountLayout from '../../components/guest/GuestAccountLayout';
import { formatDate, formatDateTime } from '../../components/guest/guestUtils';
import { bookingAPI } from '../../services/api';

const STATE = {
  PENDING: { label: 'Waiting for the property', icon: Clock, cls: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300' },
  APPROVED: { label: 'Approved - booking cancelled', icon: CheckCircle2, cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300' },
  DECLINED: { label: 'Declined - booking still active', icon: MessageSquareX, cls: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300' },
};

/** The guest's cancellation requests (sent after the free-cancellation window). */
const GuestRequests = () => {
  const [bookings, setBookings] = useState(null);
  useEffect(() => {
    bookingAPI.getBookings().then(({ data }) => setBookings(data || [])).catch(() => setBookings([]));
  }, []);
  const requests = (bookings || []).filter(b => b.cancel_request_status)
    .sort((a, b) => (b.cancel_requested_at || '').localeCompare(a.cancel_requested_at || ''));

  return (
    <GuestAccountLayout>
      <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">My requests</h1>
      <p className="text-slate-500 dark:text-slate-400">Cancellation requests you’ve sent to properties, and their replies.</p>
      <div className="mt-6 space-y-3">
        {!bookings ? (
          [0, 1].map(i => <div key={i} className="h-28 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />)
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center text-center py-14 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
            <FileClock className="w-10 h-10 text-slate-300 mb-3" />
            <p className="font-semibold text-slate-900 dark:text-white">No requests yet</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">If you need to cancel after the free-cancellation window, send a request from <Link to="/book/me/trips" className="font-semibold text-green-700 dark:text-green-400 hover:underline">My trips</Link>.</p>
          </div>
        ) : requests.map(b => {
          const st = STATE[b.cancel_request_status] || STATE.PENDING;
          const Icon = st.icon;
          return (
            <article key={b.id} className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-green-700 dark:text-green-400">{b.organization_name}</p>
                  <p className="font-semibold text-slate-900 dark:text-white">Cancel {b.room_detail?.name} · {formatDate(b.check_in)} – {formatDate(b.check_out)}
                    <span className="ml-2 text-xs font-medium text-slate-400">CX-{String(b.id).padStart(6, '0')}</span></p>
                </div>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${st.cls}`}><Icon className="w-3.5 h-3.5" />{st.label}</span>
              </div>
              <p className="mt-3 text-sm text-slate-700 dark:text-slate-200"><span className="text-slate-500 dark:text-slate-400">Your reason:</span> “{b.cancel_request_reason}”</p>
              {b.cancel_request_reply && <p className="mt-1 text-sm text-slate-700 dark:text-slate-200"><span className="text-slate-500 dark:text-slate-400">{b.organization_name} replied:</span> “{b.cancel_request_reply}”</p>}
              <p className="mt-2 text-xs text-slate-400">Sent {formatDateTime(b.cancel_requested_at)}</p>
            </article>
          );
        })}
      </div>
    </GuestAccountLayout>
  );
};

export default GuestRequests;
