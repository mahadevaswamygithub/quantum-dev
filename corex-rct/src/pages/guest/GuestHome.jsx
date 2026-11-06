import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BedDouble, Clock, Star, FileText, Loader2, MapPin, Phone, SearchX } from 'lucide-react';
import GuestLayout from '../../components/guest/GuestLayout';
import StaySearch from '../../components/guest/StaySearch';
import RoomCard from '../../components/guest/RoomCard';
import { useOrgInfo } from '../../hooks/useOrgInfo';
import Stars from '../../components/common/Stars';
import { bookingAPI } from '../../services/api';
import { cancellationRule, formatDate, formatTime, nightsBetween, primaryImage, useGuest, useStaySearch } from '../../components/guest/guestUtils';

const NotFound = () => (
  <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center bg-slate-50 dark:bg-slate-900">
    <BedDouble className="w-10 h-10 text-slate-300" />
    <p className="text-lg font-semibold text-slate-900 dark:text-white">This booking site isn't available</p>
    <p className="text-sm text-slate-500 dark:text-slate-400">The link may be wrong, or the property isn't taking bookings online.</p>
    <Link to="/book" className="mt-2 text-sm font-semibold text-green-600 hover:text-green-700">See all properties</Link>
  </div>
);

const InfoTile = ({ icon: Icon, title, children }) => (
  <div className="flex gap-3 p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
    <span className="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 flex items-center justify-center flex-shrink-0">
      <Icon className="w-5 h-5" />
    </span>
    <div className="min-w-0 text-sm text-slate-600 dark:text-slate-300">
      <p className="font-semibold text-slate-900 dark:text-white mb-1">{title}</p>
      {children}
    </div>
  </div>
);

/**
 * A property's public booking site home: hero + stay search, the rooms
 * (with live availability once dates are picked) and practical info.
 * Browsable without an account — sign-in is only asked for at "Reserve".
 */
const GuestHome = () => {
  const { orgId, propertyId } = useParams();
  const navigate = useNavigate();
  const { org, loading: orgLoading, notFound } = useOrgInfo(orgId);
  const { checkIn, checkOut, guests, setStay, query } = useStaySearch();
  const { isGuest } = useGuest();

  const [properties, setProperties] = useState([]);
  const [rooms, setRooms] = useState(null);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [heroImage, setHeroImage] = useState(null);

  const [reviews, setReviews] = useState([]);
  useEffect(() => {
    bookingAPI.getPublicReviews(orgId).then(({ data }) => setReviews(data || [])).catch(() => setReviews([]));
  }, [orgId]);

  useEffect(() => {
    bookingAPI.getPublicProperties(orgId).then(({ data }) => setProperties(data || [])).catch(() => setProperties([]));
  }, [orgId]);

  useEffect(() => {
    let cancelled = false;
    setLoadingRooms(true);
    const params = { guests: guests > 1 ? guests : undefined, property: propertyId || undefined };
    if (checkIn && checkOut) Object.assign(params, { check_in: checkIn, check_out: checkOut });
    bookingAPI.getPublicRooms(orgId, params)
      .then(({ data }) => {
        if (cancelled) return;
        setRooms(data || []);
        // Keep the first photo we see as the hero, so it doesn't jump when filters change.
        setHeroImage(prev => prev || (data || []).map(primaryImage).find(Boolean) || null);
      })
      .catch(() => { if (!cancelled) setRooms([]); })
      .finally(() => { if (!cancelled) setLoadingRooms(false); });
    return () => { cancelled = true; };
  }, [orgId, propertyId, checkIn, checkOut, guests]);

  const sortedRooms = useMemo(() => {
    if (!rooms) return [];
    // Available rooms first once dates are chosen.
    return [...rooms].sort((a, b) => (b.available === true) - (a.available === true));
  }, [rooms]);
  const availableCount = rooms?.filter(r => r.available === true).length ?? 0;
  const nights = nightsBetween(checkIn, checkOut);
  const activeProperty = properties.find(p => String(p.id) === String(propertyId));

  if (notFound) return <NotFound />;

  const propertyLink = (id) => `/book/${orgId}${id ? `/properties/${id}` : ''}${query()}`;

  return (
    <GuestLayout org={org}>
      {/* Hero */}
      <section className="relative">
        <div className="relative h-[300px] sm:h-[360px] overflow-hidden bg-gradient-to-br from-green-700 via-green-600 to-teal-500">
          {(org?.cover_image || heroImage) && <img src={org?.cover_image || heroImage} alt="" className="absolute inset-0 w-full h-full object-cover" />}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/40 to-slate-950/10" />
          {/* Signed-in guests browse inside their account (no site header), so give them a way back to the list. */}
          {isGuest && (
            <Link to="/book" className="absolute top-4 left-4 sm:left-6 lg:left-8 z-10 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 hover:bg-white text-sm font-medium text-slate-800 shadow-sm">
              <ArrowLeft className="w-4 h-4" /> All properties
            </Link>
          )}
          <div className="relative h-full px-4 sm:px-6 lg:px-8 flex flex-col justify-end pb-24 sm:pb-28">
            {orgLoading ? (
              <div className="h-10 w-64 rounded bg-white/20 animate-pulse" />
            ) : (
              <>
                <h1 className="text-3xl sm:text-5xl font-bold text-white drop-shadow-sm">{org?.name}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-white/90 text-sm sm:text-base">
                  {org?.rating_count > 0 && (
                    <a href="#reviews" className="flex items-center gap-1.5 hover:underline">
                      <Star className="w-4 h-4 fill-amber-400 text-amber-400" /><b className="text-white">{org.rating_avg}</b> · {org.rating_count} review{org.rating_count === 1 ? '' : 's'}
                    </a>
                  )}
                  {org?.address && <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" />{org.address}</span>}
                </div>
                {org && !org.accepting_bookings && (
                  <p className="mt-3 inline-flex w-fit px-3 py-1 rounded-full bg-amber-400 text-amber-950 text-sm font-semibold">
                    Not taking new bookings right now
                  </p>
                )}
              </>
            )}
          </div>
        </div>
        <div className="relative px-4 sm:px-6 lg:px-8 -mt-16 sm:-mt-20">
          <StaySearch
            checkIn={checkIn}
            checkOut={checkOut}
            guests={guests}
            onSearch={(s) => setStay(s)}
          />
        </div>
      </section>

      {/* Rooms */}
      <section className="px-4 sm:px-6 lg:px-8 mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              {activeProperty ? activeProperty.name : 'Rooms'}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {checkIn && checkOut
                ? `${formatDate(checkIn)} – ${formatDate(checkOut)} · ${nights} night${nights > 1 ? 's' : ''} · ${availableCount} available`
                : 'Pick your dates to see what’s available.'}
            </p>
          </div>
          {loadingRooms && rooms && <Loader2 className="w-5 h-5 animate-spin text-slate-400" />}
        </div>

        {properties.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
            {[{ id: null, name: 'All buildings' }, ...properties].map(p => {
              const active = String(p.id ?? '') === String(propertyId ?? '');
              return (
                <button
                  key={p.id ?? 'all'}
                  type="button"
                  onClick={() => navigate(propertyLink(p.id))}
                  className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                    active
                      ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                  }`}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
        )}

        {!rooms ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {[0, 1, 2].map(i => <div key={i} className="h-80 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />)}
          </div>
        ) : sortedRooms.length === 0 ? (
          <div className="flex flex-col items-center text-center py-16 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
            <SearchX className="w-10 h-10 text-slate-300 mb-3" />
            <p className="font-semibold text-slate-900 dark:text-white">No rooms match</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Try fewer guests{properties.length > 1 ? ' or another building' : ''}.</p>
          </div>
        ) : (
          <div className={`grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 ${loadingRooms ? 'opacity-60' : ''}`}>
            {sortedRooms.map(room => (
              <RoomCard key={room.id} room={room} checkIn={checkIn} checkOut={checkOut} to={`/book/${orgId}/rooms/${room.id}${query()}`} />
            ))}
          </div>
        )}
      </section>

      {/* Reviews */}
      {reviews.length > 0 && (
        <section id="reviews" className="px-4 sm:px-6 lg:px-8 mt-14 scroll-mt-24">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Star className="w-6 h-6 fill-amber-400 text-amber-400" /> {org?.rating_avg} · {org?.rating_count} review{org?.rating_count === 1 ? '' : 's'}
          </h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {reviews.map(r => (
              <article key={r.id} className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-slate-900 dark:text-white">{r.guest}</p>
                  <span className="text-xs text-slate-400">{new Date(r.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</span>
                </div>
                <Stars value={r.rating} size="w-3.5 h-3.5" />
                {r.comment && <p className="mt-2 text-sm text-slate-700 dark:text-slate-200 whitespace-pre-line">{r.comment}</p>}
                {r.reply && (
                  <p className="mt-3 pl-3 border-l-2 border-green-500 text-sm text-slate-600 dark:text-slate-300">
                    <b className="text-slate-900 dark:text-white">Response from {org?.name}:</b> {r.reply}
                  </p>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Good to know */}
      {org && (
        <section className="px-4 sm:px-6 lg:px-8 mt-14">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-5">Good to know</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <InfoTile icon={Clock} title="Check-in & check-out">
              <p>Check-in from {formatTime(org.check_in_time)}</p>
              <p>Check-out by {formatTime(org.check_out_time)}</p>
            </InfoTile>
            <InfoTile icon={FileText} title="Cancellation">
              <p className="font-medium text-slate-900 dark:text-white">{cancellationRule(org.free_cancellation_hours)}</p>
              {org.cancellation_policy && <p className="whitespace-pre-line mt-1">{org.cancellation_policy}</p>}
            </InfoTile>
            <InfoTile icon={Phone} title="Need help?">
              {org.contact_phone && <a className="block hover:underline" href={`tel:${org.contact_phone}`}>{org.contact_phone}</a>}
              {org.contact_email && <a className="block hover:underline break-all" href={`mailto:${org.contact_email}`}>{org.contact_email}</a>}
              {!org.contact_phone && !org.contact_email && <p>Reach the front desk on arrival.</p>}
              <p className="mt-1">
                {org.auto_confirm ? 'Instant confirmation. ' : 'The property confirms each request. '}
                {org.online_payments ? 'Pay securely online or at the property.' : 'Pay at the property when you arrive.'}
              </p>
            </InfoTile>
          </div>
        </section>
      )}
    </GuestLayout>
  );
};

export default GuestHome;
