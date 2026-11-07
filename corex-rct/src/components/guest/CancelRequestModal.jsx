import React, { useEffect, useState } from 'react';
import { AlertCircle, Loader2, Send } from 'lucide-react';
import Modal from '../common/Modal';
import { bookingAPI } from '../../services/api';
import { formatDate } from './guestUtils';

const REASONS = ['Change of plans', 'Medical or family emergency', 'Travel cancelled or delayed', 'Booked by mistake'];

/**
 * Guest asks the property to cancel a booking whose free-cancellation
 * window has passed. The booking stays active until the property decides.
 */
const CancelRequestModal = ({ booking, onClose, onSent }) => {
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (booking) { setReason(''); setError(''); } }, [booking]);
  if (!booking) return null;

  const submit = async (e) => {
    e.preventDefault();
    if (reason.trim().length < 5) { setError('Tell the property briefly why you need to cancel.'); return; }
    setSending(true); setError('');
    try {
      await bookingAPI.requestCancellation(booking.id, reason.trim());
      onSent();
      onClose();
    } catch (err) {
      const d = err.response?.data || {};
      setError(d.reason?.[0] || d.error || 'Could not send your request. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Request cancellation">
      <form onSubmit={submit} className="p-5 space-y-4">
        <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-sm text-amber-900 dark:text-amber-200">
          The free cancellation window for <b>{booking.organization_name}</b> ({formatDate(booking.check_in)} – {formatDate(booking.check_out)}) has passed.
          Your request goes to the property - your booking stays active until they reply, and we’ll email you their decision.
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Why do you need to cancel?</p>
          <div className="flex flex-wrap gap-2 mb-2">
            {REASONS.map(r => (
              <button key={r} type="button" onClick={() => setReason(r)}
                className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors ${reason === r ? 'border-green-500 bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300' : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-slate-300'}`}>
                {r}
              </button>
            ))}
          </div>
          <textarea rows={3} value={reason} onChange={e => setReason(e.target.value)} maxLength={1000}
            placeholder="Add any details the property should know…" aria-label="Reason for cancelling"
            className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500/40 focus:border-green-500" />
        </div>
        {error && <p className="flex gap-2 text-sm text-red-600 dark:text-red-400"><AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">Keep booking</button>
          <button type="submit" disabled={sending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-green-500 to-blue-500 text-white text-sm font-semibold disabled:opacity-50">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send request
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default CancelRequestModal;
