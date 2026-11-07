import React, { useEffect, useSyncExternalStore } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { bookingAPI } from '../../services/api';
import { useGuest } from './guestUtils';

// One shared copy of the signed-in guest's saved property ids, so every ♥
// on the page agrees without each card fetching the list.
let ids = new Set();
let loadedFor = null;
const listeners = new Set();
const emit = () => listeners.forEach(l => l());
const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l); };
const snapshot = () => ids;

const load = async (userId) => {
  if (loadedFor === userId) return;
  loadedFor = userId;
  try {
    const { data } = await bookingAPI.getWishlist();
    ids = new Set(data.ids);
  } catch { ids = new Set(); }
  emit();
};

/** {saved(id), toggle(id), count} for the signed-in guest. */
export const useWishlist = () => {
  const { user, isGuest } = useGuest();
  const current = useSyncExternalStore(subscribe, snapshot);
  useEffect(() => {
    if (isGuest) load(user.id);
    else if (loadedFor !== null) { loadedFor = null; ids = new Set(); emit(); }
  }, [isGuest, user?.id]);

  const toggle = async (orgId) => {
    const had = ids.has(orgId);
    const next = new Set(ids);
    if (had) next.delete(orgId); else next.add(orgId);
    ids = next; emit();                                   // optimistic
    try {
      if (had) await bookingAPI.removeFromWishlist(orgId);
      else await bookingAPI.addToWishlist(orgId);
    } catch {
      const undo = new Set(ids);
      if (had) undo.add(orgId); else undo.delete(orgId);
      ids = undo; emit();
    }
  };
  return { saved: (id) => current.has(id), toggle, count: current.size, isGuest };
};

/** ♥ button. Visitors are sent to log in first. */
export const HeartButton = ({ orgId, className = '', light = false, label = false }) => {
  const { saved, toggle, isGuest } = useWishlist();
  const navigate = useNavigate();
  const location = useLocation();
  const on = saved(orgId);
  const click = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isGuest) {
      navigate(`/book/login?next=${encodeURIComponent(location.pathname + location.search)}`);
      return;
    }
    toggle(orgId);
  };
  return (
    <button
      type="button"
      onClick={click}
      aria-pressed={on}
      aria-label={on ? 'Remove from wishlist' : 'Save to wishlist'}
      title={on ? 'Saved to your wishlist' : 'Save to wishlist'}
      className={`inline-flex items-center justify-center gap-1.5 rounded-full transition-all active:scale-90 ${
        light ? 'bg-white/90 hover:bg-white text-slate-700 shadow' : 'bg-white/15 hover:bg-white/25 text-white border border-white/25 backdrop-blur'
      } ${label ? 'px-3.5 h-9 text-sm font-semibold' : 'w-9 h-9'} ${className}`}
    >
      <Heart className={`w-[18px] h-[18px] transition-colors ${on ? 'fill-rose-500 text-rose-500' : ''}`} />
      {label && (on ? 'Saved' : 'Save')}
    </button>
  );
};
