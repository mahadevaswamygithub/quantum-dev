import React, { useState, useEffect, useCallback } from 'react';
import Modal from './common/Modal';
import PageSpinner from './common/PageSpinner';
import { bookingAPI } from '../services/api';
import { CalendarPlus, CreditCard, LogIn, LogOut, Ban, RotateCcw, Clock } from 'lucide-react';

// Keyed by the *to* status in a log's changes.status: [old, new] pair -
// covers every transition BookingViewSet writes (create/verify_payment/
// confirm/check_in/check_out/cancel/refund in apps/bookings/views.py).
const EVENT_META = {
  CREATE: { label: 'Booking made', icon: CalendarPlus, tone: 'text-blue-500 bg-blue-500/10' },
  CONFIRMED: { label: 'Confirmed', icon: CreditCard, tone: 'text-blue-500 bg-blue-500/10' },
  CHECKED_IN: { label: 'Checked in', icon: LogIn, tone: 'text-green-500 bg-green-500/10' },
  CHECKED_OUT: { label: 'Checked out', icon: LogOut, tone: 'text-slate-500 bg-slate-500/10' },
  CANCELLED: { label: 'Cancelled', icon: Ban, tone: 'text-red-500 bg-red-500/10' },
};

const eventFor = (log) => {
  if (log.action === 'CREATE') return EVENT_META.CREATE;
  const toStatus = log.changes?.status?.[1];
  const meta = EVENT_META[toStatus] || { label: 'Updated', icon: Clock, tone: 'text-slate-500 bg-slate-500/10' };
  // A cancel that also carries a payment refund (refund() in views.py) reads better as its own line.
  if (toStatus === 'CANCELLED' && log.changes?.payment?.[1] === 'REFUNDED') {
    return { ...meta, label: 'Cancelled & refunded', icon: RotateCcw };
  }
  return meta;
};

/**
 * Full timeline for one booking - made / confirmed / checked in / checked
 * out / cancelled - each with who did it and exactly when. Pulls from
 * GET /bookings/reservations/<id>/history/ (apps/bookings/views.py
 * BookingViewSet.history), which reads the same ActivityLog rows the
 * admin-only Activity Log page shows, just filtered to this one booking and
 * open to the booking's own customer too.
 */
const BookingHistoryModal = ({ bookingId, onClose }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await bookingAPI.getBookingHistory(bookingId);
      setLogs(data || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load history for this reservation.');
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => { if (bookingId) fetchHistory(); }, [bookingId, fetchHistory]);

  return (
    <Modal isOpen={!!bookingId} onClose={onClose} title="Reservation History">
      <div className="p-5">
        {loading ? (
          <PageSpinner label="Loading history..." />
        ) : error ? (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-600 dark:text-red-400 text-sm">{error}</div>
        ) : logs.length === 0 ? (
          <div className="text-center text-slate-500 dark:text-slate-400 text-sm py-6">No history recorded for this reservation yet.</div>
        ) : (
          <ol className="relative border-l border-slate-200 dark:border-slate-700 ml-3 space-y-6">
            {logs.map(log => {
              const { label, icon: Icon, tone } = eventFor(log);
              return (
                <li key={log.id} className="ml-5">
                  <span className={`absolute -left-3.5 flex items-center justify-center w-7 h-7 rounded-full ${tone}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </span>
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <p className="font-semibold text-slate-900 dark:text-white text-sm">{label}</p>
                    <p className="text-xs text-slate-400">{new Date(log.created_at).toLocaleString()}</p>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    by {log.actor_username || 'System'}{log.actor_role ? ` · ${log.actor_role.replace('_', ' ')}` : ''}
                  </p>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </Modal>
  );
};

export default BookingHistoryModal;
