import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BedDouble, MapPin, Search, SearchX, Star } from 'lucide-react';
import Avatar from '../components/common/Avatar';
import GuestLayout from '../components/guest/GuestLayout';
import { bookingAPI } from '../services/api';
import { formatMoney } from '../components/guest/guestUtils';

const PropertyCard = ({ org }) => (
  <Link
    to={`/book/${org.id}`}
    className="group block rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:shadow-xl hover:-translate-y-0.5 transition-all"
  >
    <div className="relative aspect-[4/3]">
      <div className="absolute inset-0 overflow-hidden bg-gradient-to-br from-green-500 to-emerald-600">
        {org.cover_image ? (
          <img src={org.cover_image} alt="" loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/70"><BedDouble className="w-12 h-12" /></div>
        )}
      </div>
      {!org.accepting_bookings && (
        <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-900/80 text-white">Not taking bookings</span>
      )}
      <Avatar
        src={org.logo}
        icon={BedDouble}
        className="absolute -bottom-6 left-4 w-12 h-12 rounded-xl ring-4 ring-white dark:ring-slate-800 shadow"
        bg="bg-green-600"
      />
    </div>
    <div className="px-4 pt-8 pb-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-lg text-slate-900 dark:text-white truncate">{org.name}</h3>
        {org.rating_count > 0 ? (
          <span className="flex items-center gap-1 text-sm font-semibold text-slate-900 dark:text-white flex-shrink-0">
            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />{org.rating_avg}
            <span className="font-normal text-slate-500 dark:text-slate-400">({org.rating_count})</span>
          </span>
        ) : <span className="text-xs text-slate-400 flex-shrink-0">New</span>}
      </div>
      <p className="mt-0.5 flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 truncate">
        <MapPin className="w-4 h-4 flex-shrink-0" />{org.address || 'Address on request'}
      </p>
      <div className="mt-3 flex items-end justify-between gap-2">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {org.room_count} room{org.room_count !== 1 ? 's' : ''}
        </p>
        {org.min_price != null && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            from <span className="text-base font-bold text-slate-900 dark:text-white">{formatMoney(org.min_price)}</span> / night
          </p>
        )}
      </div>
    </div>
  </Link>
);

/**
 * Shared entry point to every property that takes bookings on CoreX —
 * visitors land here and pick where to stay. Each card opens that
 * property's own booking site, which links back here ("All properties").
 */
const BookingHome = () => {
  const [orgs, setOrgs] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    bookingAPI.getPublicOrgList()
      .then(({ data }) => setOrgs(data || []))
      .catch(() => setOrgs([]));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = orgs || [];
    if (!q) return list;
    return list.filter(o => o.name.toLowerCase().includes(q) || (o.address || '').toLowerCase().includes(q));
  }, [orgs, search]);

  return (
    <GuestLayout org={null}>

      <section className="bg-gradient-to-br from-green-600 to-green-600">
        <div className="px-4 sm:px-6 lg:px-8 pt-10 pb-16 sm:pt-12 sm:pb-20 text-center">
          <h1 className="text-3xl sm:text-5xl font-bold text-white">Find your next stay</h1>
          <p className="mt-3 text-white/85 sm:text-lg">Book directly with the property — no middlemen, no booking fees.</p>
        </div>
      </section>

      <div className="w-full px-4 sm:px-6 lg:px-8 -mt-8">
        <label className="relative block">
          <span className="sr-only">Search properties</span>
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or area…"
            className="w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 shadow-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </label>

        <div className="mt-10 mb-5 flex items-end justify-between">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Places to stay</h2>
          {orgs && <p className="text-sm text-slate-500 dark:text-slate-400">{filtered.length} propert{filtered.length === 1 ? 'y' : 'ies'}</p>}
        </div>

        {!orgs ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {[0, 1, 2].map(i => <div key={i} className="h-80 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center text-center py-16 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
            <SearchX className="w-10 h-10 text-slate-300 mb-3" />
            <p className="font-semibold text-slate-900 dark:text-white">{orgs.length ? 'No properties match your search' : 'No properties are taking bookings yet'}</p>
            {search && <button type="button" onClick={() => setSearch('')} className="mt-2 text-sm font-semibold text-green-600">Clear search</button>}
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {filtered.map(org => <PropertyCard key={org.id} org={org} />)}
          </div>
        )}
      </div>
    </GuestLayout>
  );
};

export default BookingHome;
