import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, BellOff, CalendarCheck, CalendarPlus, CheckCircle2, Clock, CreditCard, IndianRupee, MessageSquareWarning, MessageSquareX, Star, XCircle } from 'lucide-react';
import { bookingAPI } from '../../services/api';
import { useGuest } from './guestUtils';

const ICON = {
  confirmed: CheckCircle2, payment_due: CreditCard, awaiting: Clock, check_in_soon: CalendarCheck, review: Star,
  cancel_pending: Clock, cancel_declined: MessageSquareX, cancel_approved: XCircle, cancelled: XCircle,
  // staff
  cancel_request: MessageSquareWarning, pending: Clock, new_booking: CalendarPlus, payment: IndianRupee,
};
const TONE = {
  success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  danger: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  info: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
};
const seenKey = (userId) => `corex-seen:${userId}`;
const readSeen = (userId) => { try { return new Set(JSON.parse(localStorage.getItem(seenKey(userId)) || '[]')); } catch { return new Set(); } };
const writeSeen = (userId, set) => { try { localStorage.setItem(seenKey(userId), JSON.stringify([...set].slice(-200))); } catch { /* storage unavailable */ } };

const ago = (iso) => {
  if (!iso) return '';
  const mins = Math.round((Date.now() - new Date(iso)) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d < 30 ? `${d} d ago` : new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

/**
 * Notification bell with an unread count remembered per browser. Guests get
 * booking updates; staff pass `load`/`footer` for the front-desk feed.
 */
const NotificationsBell = ({
  light = false, load: fetchItems = bookingAPI.getGuestNotifications, footer = { to: '/book/me/trips', label: 'View all trips' },
}) => {
  const { user } = useGuest();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(() => readSeen(user.id));
  const ref = useRef(null);

  const load = useCallback(() => {
    fetchItems().then(({ data }) => setItems(data || [])).catch(() => {});
  }, [fetchItems]);
  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  const unread = items.filter(i => !seen.has(i.id)).length;
  const markAll = () => {
    const next = new Set([...seen, ...items.map(i => i.id)]);
    setSeen(next); writeSeen(user.id, next);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label={`Notifications${unread ? ` (${unread} new)` : ''}`}
        aria-expanded={open}
        className={`relative w-10 h-10 rounded-xl border flex items-center justify-center transition-colors ${
          light ? 'border-white/20 bg-white/10 text-white hover:bg-white/20' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-green-600'
        }`}
      >
        <Bell className="w-[18px] h-[18px]" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white dark:ring-slate-900">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-[min(calc(100vw-2rem),24rem)] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-2xl z-50 overflow-hidden animate-pop-in motion-reduce:animate-none origin-top-right">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
            <p className="font-bold text-slate-900 dark:text-white">Notifications</p>
            {unread > 0 && <button type="button" onClick={markAll} className="text-xs font-semibold text-green-700 dark:text-green-400 hover:underline">Mark all as read</button>}
          </div>
          {items.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
              <BellOff className="w-8 h-8 mx-auto mb-2 text-slate-300" />You’re all caught up.
            </div>
          ) : (
            <ul className="max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
              {items.map(i => {
                const Icon = ICON[i.kind] || Bell;
                const isNew = !seen.has(i.id);
                return (
                  <li key={i.id}>
                    <Link to={i.link} onClick={() => { const n = new Set(seen).add(i.id); setSeen(n); writeSeen(user.id, n); setOpen(false); }}
                      className={`flex gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 ${isNew ? 'bg-green-50/50 dark:bg-green-500/5' : ''}`}>
                      <span className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${TONE[i.tone] || TONE.info}`}><Icon className="w-4 h-4" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-slate-900 dark:text-white">{i.title}</span>
                        <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">{i.body}</span>
                        <span className="block mt-0.5 text-[11px] text-slate-400">{ago(i.at)}</span>
                      </span>
                      {isNew && <span className="mt-1.5 w-2 h-2 rounded-full bg-green-500 flex-shrink-0" aria-label="New" />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <Link to={footer.to} onClick={() => setOpen(false)} className="block px-4 py-2.5 text-center text-xs font-semibold text-slate-600 dark:text-slate-300 border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
            {footer.label}
          </Link>
        </div>
      )}
    </div>
  );
};

export default NotificationsBell;
