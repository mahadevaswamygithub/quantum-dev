import React, { useEffect, useState } from 'react';
import { Banknote, CreditCard, Loader2, Smartphone, Wallet } from 'lucide-react';
import Modal from './common/Modal';
import { bookingAPI } from '../services/api';
import { formatMoney } from './guest/guestUtils';

const METHODS = [
  { id: 'CASH', label: 'Cash', icon: Banknote },
  { id: 'UPI', label: 'UPI', icon: Smartphone },
  { id: 'CARD', label: 'Card', icon: CreditCard },
  { id: 'OTHER', label: 'Other', icon: Wallet },
];

const inputCls = 'w-full px-3 py-2.5 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500';

/** Staff record money taken at the desk for a booking (full or part of what's owed). */
const RecordPaymentModal = ({ booking, onClose, onSaved }) => {
  const [method, setMethod] = useState('CASH');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (booking) { setMethod('CASH'); setAmount(String(Number(booking.balance_due))); setNote(''); setError(''); }
  }, [booking]);

  if (!booking) return null;

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await bookingAPI.recordPayment(booking.id, { method, amount, note });
      onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not record the payment.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Record payment">
      <form onSubmit={submit} className="p-5 space-y-4">
        <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50 text-sm">
          <p className="font-medium text-slate-900 dark:text-white">{booking.customer_name} · {booking.room_detail?.name}</p>
          <p className="text-slate-500 dark:text-slate-400">
            Total {formatMoney(booking.total_amount)} · paid {formatMoney(booking.amount_paid)} ·{' '}
            <span className="font-semibold text-slate-900 dark:text-white">{formatMoney(booking.balance_due)} due</span>
          </p>
        </div>
        {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-600 dark:text-red-400 text-sm">{error}</div>}
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Paid by</p>
          <div className="grid grid-cols-4 gap-2" role="radiogroup">
            {METHODS.map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" role="radio" aria-checked={method === id} onClick={() => setMethod(id)}
                className={`flex flex-col items-center gap-1 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                  method === id ? 'border-green-500 bg-green-500/10 text-green-700 dark:text-green-400' : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-slate-400'
                }`}>
                <Icon className="w-5 h-5" />{label}
              </button>
            ))}
          </div>
        </div>
        <label className="block">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Amount received (₹)</span>
          <input type="number" min="0.01" step="0.01" max={booking.balance_due} required value={amount}
            onChange={e => setAmount(e.target.value)} className={`mt-1.5 ${inputCls}`} />
          <span className="mt-1 block text-xs text-slate-400">Part payments are fine - the rest stays due.</span>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Note (optional)</span>
          <input value={note} onChange={e => setNote(e.target.value)} maxLength={200} placeholder="e.g. UPI ref 4821" className={`mt-1.5 ${inputCls}`} />
        </label>
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white text-sm font-medium rounded-lg">Cancel</button>
          <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50 flex items-center justify-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Record {amount ? formatMoney(amount) : ''}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default RecordPaymentModal;
