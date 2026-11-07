import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2, UserPlus } from 'lucide-react';
import Modal from './common/Modal';
import { bookingAPI } from '../services/api';
import { usePermissions } from '../hooks/usePermissions';

const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (s, n) => { const [y, m, d] = s.split('-').map(Number); return iso(new Date(y, m - 1, d + n)); };
const today = () => iso(new Date());
const input = 'mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 [color-scheme:light] dark:[color-scheme:dark]';
const label = 'block text-xs font-semibold text-slate-600 dark:text-slate-300';

/**
 * Front desk books a room for a guest at the counter or on the phone.
 * `preset` may carry {room, check_in} (e.g. from a click on the room calendar).
 */
const WalkInModal = ({ open, preset = {}, onClose, onSaved }) => {
  const { can } = usePermissions();
  const [rooms, setRooms] = useState([]);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!open) return;
    const start = preset.check_in && preset.check_in >= today() ? preset.check_in : today();
    setForm({
      room: preset.room ? String(preset.room) : '', check_in: start, check_out: addDays(start, 1), guests: 1,
      guest_name: '', guest_phone: '', guest_email: '', special_requests: '', check_in_now: start === today(),
      take_payment: false, method: 'CASH', amount: '',
    });
    setErrors({});
    bookingAPI.getRooms().then(({ data }) => setRooms((data || []).filter(r => r.is_active !== false))).catch(() => setRooms([]));
  }, [open, preset.room, preset.check_in]);

  const room = rooms.find(r => String(r.id) === String(form?.room));
  const nights = useMemo(() => {
    if (!form?.check_in || !form?.check_out) return 0;
    return Math.max(0, Math.round((new Date(form.check_out) - new Date(form.check_in)) / 86400000));
  }, [form?.check_in, form?.check_out]);
  const total = room ? nights * Number(room.price_per_night) : 0;

  if (!open || !form) return null;
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const err = (k) => errors[k] && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{[].concat(errors[k])[0]}</p>;

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true); setErrors({});
    try {
      await bookingAPI.createWalkIn({
        room: form.room, check_in: form.check_in, check_out: form.check_out, guests: Number(form.guests),
        guest_name: form.guest_name, guest_phone: form.guest_phone, guest_email: form.guest_email,
        special_requests: form.special_requests, check_in_now: form.check_in_now && form.check_in === today(),
        payment: form.take_payment ? { method: form.method, amount: form.amount || undefined } : undefined,
      });
      onSaved?.();
      onClose();
    } catch (ex) {
      setErrors(ex.response?.data && typeof ex.response.data === 'object' ? ex.response.data : { error: 'Could not save the booking.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="New walk-in / phone booking" wide>
      <form onSubmit={submit} className="p-5 space-y-5">
        <div className="grid gap-4 sm:grid-cols-4">
          <label className="sm:col-span-2">
            <span className={label}>Room</span>
            <select value={form.room} onChange={set('room')} required className={input}>
              <option value="">Choose a room…</option>
              {rooms.map(r => <option key={r.id} value={r.id}>{r.name}{r.property_name ? ` · ${r.property_name}` : ''} - ₹{Number(r.price_per_night).toLocaleString('en-IN')}/night · sleeps {r.capacity}</option>)}
            </select>
            {err('room')}
          </label>
          <label>
            <span className={label}>Check-in</span>
            <input type="date" min={today()} value={form.check_in} required className={input}
              onChange={e => { const v = e.target.value; setForm(f => ({ ...f, check_in: v, check_out: f.check_out > v ? f.check_out : addDays(v, 1) })); }} />
            {err('check_in')}
          </label>
          <label>
            <span className={label}>Check-out</span>
            <input type="date" min={addDays(form.check_in, 1)} value={form.check_out} onChange={set('check_out')} required className={input} />
            {err('check_out')}
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <label>
            <span className={label}>Guest name</span>
            <input value={form.guest_name} onChange={set('guest_name')} required className={input} placeholder="Full name" />
            {err('guest_name')}
          </label>
          <label>
            <span className={label}>Phone</span>
            <input type="tel" value={form.guest_phone} onChange={set('guest_phone')} required className={input} placeholder="+91 98765 43210" />
            {err('guest_phone')}
          </label>
          <label>
            <span className={label}>Email <span className="font-normal text-slate-400">(optional - sends the confirmation)</span></span>
            <input type="email" value={form.guest_email} onChange={set('guest_email')} className={input} placeholder="guest@example.com" />
            {err('guest_email')}
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          <label>
            <span className={label}>Guests</span>
            <input type="number" min={1} max={room?.capacity || 10} value={form.guests} onChange={set('guests')} className={input} />
            {err('guests')}
          </label>
          <label className="sm:col-span-3">
            <span className={label}>Notes / special requests</span>
            <input value={form.special_requests} onChange={set('special_requests')} className={input} placeholder="ID checked, extra bed…" />
          </label>
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-3">
          {form.check_in === today() && (
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input type="checkbox" checked={form.check_in_now} onChange={set('check_in_now')} className="w-4 h-4 rounded" /> Check the guest in now
            </label>
          )}
          {can('payments.collect') && (
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input type="checkbox" checked={form.take_payment} onChange={set('take_payment')} className="w-4 h-4 rounded" /> Take payment now
            </label>
          )}
        </div>
        {form.take_payment && (
          <div className="grid gap-4 sm:grid-cols-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700">
            <label>
              <span className={label}>Method</span>
              <select value={form.method} onChange={set('method')} className={input}>
                <option value="CASH">Cash</option><option value="UPI">UPI</option><option value="CARD">Card</option><option value="OTHER">Other</option>
              </select>
            </label>
            <label>
              <span className={label}>Amount (₹)</span>
              <input type="number" min="1" step="0.01" value={form.amount} onChange={set('amount')} className={input} placeholder={total ? `${total} (full)` : 'Full amount'} />
            </label>
            {err('payment')}
          </div>
        )}

        {errors.error && <p className="flex gap-2 text-sm text-red-600 dark:text-red-400"><AlertCircle className="w-4 h-4 mt-0.5" />{errors.error}</p>}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {room && nights > 0 ? <><b className="text-slate-900 dark:text-white text-base">₹{total.toLocaleString('en-IN')}</b> · {nights} night{nights > 1 ? 's' : ''} × ₹{Number(room.price_per_night).toLocaleString('en-IN')}</> : 'Choose a room and dates'}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">Cancel</button>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} Confirm booking
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
};

export default WalkInModal;
