import React, { useEffect, useState } from 'react';
import { AlertCircle, Ban, Check, Loader2 } from 'lucide-react';
import Modal from './common/Modal';
import { bookingAPI } from '../services/api';

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

/** Staff approve (cancel, optionally refund) or decline a guest's late cancellation request. */
const CancelRequestDecisionModal = ({ booking, canRefund, onClose, onSaved }) => {
  const [note, setNote] = useState('');
  const [refund, setRefund] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { if (booking) { setNote(''); setRefund(false); setError(''); } }, [booking]);
  if (!booking) return null;
  const paid = Number(booking.amount_paid) > 0;

  const decide = async (decision) => {
    setBusy(decision); setError('');
    try {
      await bookingAPI.decideCancelRequest(booking.id, { decision, note: note.trim(), refund: decision === 'approve' && refund });
      onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save your decision.');
    } finally {
      setBusy('');
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Cancellation request">
      <div className="p-5 space-y-4 text-sm">
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700">
          <p className="font-semibold text-slate-900 dark:text-white">{booking.customer_name} · {booking.room_detail?.name}</p>
          <p className="text-slate-500 dark:text-slate-400">{booking.check_in} → {booking.check_out} · {money(booking.total_amount)}{paid ? ` · paid ${money(booking.amount_paid)}` : ''}</p>
          <p className="mt-2 text-slate-700 dark:text-slate-200"><span className="font-semibold">Reason:</span> “{booking.cancel_request_reason}”</p>
          <p className="mt-1 text-xs text-slate-400">Requested {new Date(booking.cancel_requested_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })} - after the free-cancellation window.</p>
        </div>
        <label className="block">
          <span className="font-semibold text-slate-700 dark:text-slate-200">Message to the guest <span className="font-normal text-slate-400">(optional, included in the email)</span></span>
          <textarea rows={3} value={note} onChange={e => setNote(e.target.value)} maxLength={1000}
            placeholder="e.g. We’ve cancelled it and refunded you in full."
            className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500" />
        </label>
        {paid && (
          <label className={`flex items-start gap-2.5 ${canRefund ? '' : 'opacity-60'}`}>
            <input type="checkbox" checked={refund} disabled={!canRefund} onChange={e => setRefund(e.target.checked)} className="mt-0.5 w-4 h-4 rounded" />
            <span className="text-slate-700 dark:text-slate-200">
              Refund the guest’s payment of {money(booking.amount_paid)} when approving
              {!canRefund && <span className="block text-xs text-slate-400">Your role can’t issue refunds - a manager can refund it later from Bookings.</span>}
            </span>
          </label>
        )}
        {error && <p className="flex gap-2 text-red-600 dark:text-red-400"><AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />{error}</p>}
        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <button type="button" onClick={() => decide('decline')} disabled={!!busy}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50">
            {busy === 'decline' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />} Decline
          </button>
          <button type="button" onClick={() => decide('approve')} disabled={!!busy}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold disabled:opacity-50">
            {busy === 'approve' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Approve &amp; cancel booking
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default CancelRequestDecisionModal;
