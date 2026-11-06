import React, { useEffect, useState } from 'react';
import { Loader2, Lock, Star, X } from 'lucide-react';
import { bookingAPI } from '../../services/api';

const LABELS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

/** Guest rates a completed stay: stars, public comment, optional private note to the property. */
const RateStayModal = ({ booking, onClose, onSaved }) => {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [privateNote, setPrivateNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!booking) return undefined;
    setRating(0); setComment(''); setPrivateNote(''); setError('');
    const esc = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [booking, onClose]);

  if (!booking) return null;
  const shown = hover || rating;

  const submit = async (e) => {
    e.preventDefault();
    if (!rating) { setError('Choose a star rating.'); return; }
    setSaving(true);
    setError('');
    try {
      await bookingAPI.submitReview(booking.id, { rating, comment, private_feedback: privateNote });
      onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save your review.');
    } finally {
      setSaving(false);
    }
  };

  const field = 'mt-1 w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 p-0 sm:p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Rate your stay"
        className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Rate your stay</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{booking.organization_name} · {booking.room_detail?.name}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <div className="flex" role="radiogroup" aria-label="Rating" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map(i => (
              <button key={i} type="button" role="radio" aria-checked={rating === i} aria-label={`${i} star${i > 1 ? 's' : ''}`}
                onClick={() => setRating(i)} onMouseEnter={() => setHover(i)} className="p-0.5">
                <Star className={`w-8 h-8 transition-colors ${i <= shown ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600'}`} />
              </button>
            ))}
          </div>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{LABELS[shown]}</span>
        </div>

        <label className="block mt-5">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Tell other guests about it <span className="font-normal text-slate-400">(optional)</span></span>
          <textarea rows={3} value={comment} onChange={e => setComment(e.target.value)} maxLength={2000} placeholder="Clean room, friendly staff…" className={field} />
        </label>
        <label className="block mt-4">
          <span className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
            <Lock className="w-3.5 h-3.5" /> Private note to the property <span className="font-normal text-slate-400">(optional)</span>
          </span>
          <textarea rows={2} value={privateNote} onChange={e => setPrivateNote(e.target.value)} maxLength={2000} placeholder="Only the property sees this — e.g. the AC was noisy." className={field} />
        </label>

        {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button type="submit" disabled={saving}
          className="mt-5 w-full py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />} Submit review
        </button>
      </form>
    </div>
  );
};

export default RateStayModal;
