import { useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/** Helpers shared by the guest-facing booking site pages. */

const pad = (n) => String(n).padStart(2, '0');
const toISODate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayISO = () => toISODate(new Date());
export const addDaysISO = (iso, days) => {
  const [y, m, d] = iso.split('-').map(Number);
  return toISODate(new Date(y, m - 1, d + days));
};
export const nightsBetween = (checkIn, checkOut) => {
  if (!checkIn || !checkOut) return 0;
  const [a, b] = [checkIn, checkOut].map(s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); });
  return Math.max(0, Math.round((b - a) / 86400000));
};

/** "2026-11-17" → "Tue, 17 Nov" (year added when not this year). */
export const formatDate = (iso, { withYear = false } = {}) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const showYear = withYear || y !== new Date().getFullYear();
  return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', ...(showYear ? { year: 'numeric' } : {}) });
};

/** ISO datetime → "Thu, 12 Nov, 2:00 PM" in the viewer's time zone. */
export const formatDateTime = (iso) => (iso
  ? new Date(iso).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
  : '');

/** Guest-facing summary of a property's cancellation rule. */
export const cancellationRule = (hours) => (Number(hours)
  ? `Free cancellation until ${hours} hours before check-in.`
  : 'Free cancellation until check-in time.');

/** "14:00" → "2:00 PM". */
export const formatTime = (hhmm) => {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${((h + 11) % 12) + 1}:${pad(m)} ${suffix}`;
};

export const formatMoney = (amount) =>
  `₹${Number(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: Number(amount) % 1 ? 2 : 0 })}`;

export const ROOM_TYPE_LABELS = {
  SINGLE: 'Single room', DOUBLE: 'Double room', SUITE: 'Suite',
  DELUXE: 'Deluxe room', CONFERENCE: 'Conference room', OTHER: 'Room',
};

export const primaryImage = (room) => (room?.images?.find(i => i.is_primary) || room?.images?.[0])?.image || null;

/** Is the signed-in user a guest? One guest account works at every property. */
export const useGuest = () => {
  const { orgId } = useParams();
  const { user } = useAuth();
  const isGuest = !!user && user.role === 'CUSTOMER';
  return { orgId, user, isGuest };
};

/** Stay search (dates + guests) kept in the URL so it survives navigation and sharing. */
export const useStaySearch = () => {
  const [params, setParams] = useSearchParams();
  const stay = useMemo(() => {
    const checkIn = params.get('check_in') || '';
    const checkOut = params.get('check_out') || '';
    const valid = checkIn && checkOut && checkOut > checkIn && checkIn >= todayISO();
    return {
      checkIn: valid ? checkIn : '',
      checkOut: valid ? checkOut : '',
      guests: Math.max(1, Number(params.get('guests')) || 1),
    };
  }, [params]);

  const setStay = (next) => {
    const merged = { ...stay, ...next };
    const p = new URLSearchParams(params);
    ['check_in', 'check_out', 'guests'].forEach(k => p.delete(k));
    if (merged.checkIn && merged.checkOut) { p.set('check_in', merged.checkIn); p.set('check_out', merged.checkOut); }
    if (merged.guests > 1) p.set('guests', String(merged.guests));
    setParams(p, { replace: true });
  };

  const query = () => {
    const p = new URLSearchParams();
    if (stay.checkIn && stay.checkOut) { p.set('check_in', stay.checkIn); p.set('check_out', stay.checkOut); }
    if (stay.guests > 1) p.set('guests', String(stay.guests));
    const s = p.toString();
    return s ? `?${s}` : '';
  };

  return { ...stay, setStay, query };
};
