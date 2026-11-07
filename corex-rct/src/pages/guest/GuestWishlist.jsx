import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import GuestAccountLayout from '../../components/guest/GuestAccountLayout';
import { StayCard } from '../../components/guest/StayCards';
import { useWishlist } from '../../components/guest/wishlist';
import { bookingAPI } from '../../services/api';

/** Properties the guest saved with ♥. */
const GuestWishlist = () => {
  const { saved } = useWishlist();
  const [stays, setStays] = useState(null);
  useEffect(() => {
    bookingAPI.getWishlist().then(({ data }) => setStays(data.stays || [])).catch(() => setStays([]));
  }, []);
  // Un-♥ on this page removes the card straight away.
  const shown = (stays || []).filter(s => saved(s.id));

  return (
    <GuestAccountLayout>
      <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Wishlist</h1>
      <p className="text-slate-500 dark:text-slate-400">Places you’ve saved for later.</p>
      <div className="mt-6">
        {!stays ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[0, 1, 2].map(i => <div key={i} className="h-[26rem] rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />)}
          </div>
        ) : shown.length === 0 ? (
          <div className="flex flex-col items-center text-center py-14 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
            <Heart className="w-10 h-10 text-slate-300 mb-3" />
            <p className="font-semibold text-slate-900 dark:text-white">Nothing saved yet</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Tap ♥ on any property to save it here.</p>
            <Link to="/book/stays" className="mt-4 px-5 py-2.5 rounded-full bg-gradient-to-r from-green-500 to-blue-500 text-white text-sm font-semibold">Explore stays</Link>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {shown.map(s => <StayCard key={s.id} stay={s} to={`/book/${s.id}`} />)}
          </div>
        )}
      </div>
    </GuestAccountLayout>
  );
};

export default GuestWishlist;
