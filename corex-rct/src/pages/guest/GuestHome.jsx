import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BadgeCheck, BedDouble, ChevronRight, Clock, CreditCard, Star, FileText, Loader2, MapPin, Phone, SearchX, Zap } from 'lucide-react';
import GuestLayout from '../../components/guest/GuestLayout';
import StaySearch from '../../components/guest/StaySearch';
import RoomCard from '../../components/guest/RoomCard';
import { useOrgInfo } from '../../hooks/useOrgInfo';
import Stars from '../../components/common/Stars';
import { bookingAPI } from '../../services/api';
import { cancellationRule, formatDate, formatTime, nightsBetween, primaryImage, useStaySearch } from '../../components/guest/guestUtils';
import { CONTAINER, EYEBROW } from '../../components/guest/site';
import TechBackdrop from '../../components/guest/TechBackdrop';
import { HeartButton } from '../../components/guest/wishlist';

const NotFound = () => (
  <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center bg-slate-50 dark:bg-slate-900">
    <BedDouble className="w-10 h-10 text-slate-300" />
    <p className="text-lg font-semibold text-slate-900 dark:text-white">This booking site isn't available</p>
    <p className="text-sm text-slate-500 dark:text-slate-400">The link may be wrong, or the property isn't taking bookings online.</p>
    <Link to="/book/stays" className="mt-2 text-sm font-semibold text-brand-700 hover:underline">See all stays</Link>
  </div>
);

const InfoTile = ({ icon: Icon, title, children }) => (
  <div className="flex gap-3 p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
    <span className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center flex-shrink-0">
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
 * Browsable without an account - sign-in is only asked for at "Reserve".
 */
const GuestHome = () => {
  const { orgId, propertyId } = useParams();
  const navigate = useNavigate();
  const { org, loading: orgLoading, notFound } = useOrgInfo(orgId);
  const { checkIn, checkOut, guests, setStay, query } = useStaySearch();

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

  const perks = org ? [
    { icon: Zap, text: org.auto_confirm ? 'Instant confirmation' : 'Confirmed by the property' },
    { icon: BadgeCheck, text: cancellationRule(org.free_cancellation_hours).replace(/\.$/, '') },
    { icon: CreditCard, text: org.online_payments ? 'Pay online or at the property' : 'Pay at the property' },
  ] : [];

  return (
    <GuestLayout org={org} overlay>
      {/* Hero */}
      <section className="relative min-h-[560px] h-[72vh] max-h-[760px] flex items-end bg-navy-900">
        {(org?.cover_image || heroImage) && <img src={org?.cover_image || heroImage} alt="" className="absolute inset-0 w-full h-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-b from-navy-950/70 via-navy-950/40 to-navy-950/90" />
        <TechBackdrop intensity="soft" />
        <div className={`${CONTAINER} relative pt-28 pb-8`}>
          <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-white/70">
            <Link to="/book" className="hover:text-white">Home</Link><ChevronRight className="w-4 h-4" />
            <Link to="/book/stays" className="hover:text-white">Stays</Link><ChevronRight className="w-4 h-4" />
            <span className="text-white font-medium truncate">{org?.name || '…'}</span>
          </nav>
          {orgLoading ? (
            <div className="mt-4 h-12 w-80 max-w-full rounded-lg bg-white/20 animate-pulse" />
          ) : (
            <>
              <div className="mt-3 flex flex-wrap items-center gap-4">
                <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white drop-shadow">{org?.name}</h1>
                {org && <HeartButton orgId={org.id} label />}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-white/90 text-sm sm:text-base">
                {org?.rating_count > 0 && (
                  <a href="#reviews" className="inline-flex items-center gap-1.5 hover:underline">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-600 text-white text-sm font-bold"><Star className="w-3.5 h-3.5 fill-white" />{org.rating_avg}</span>
                    {org.rating_count} review{org.rating_count === 1 ? '' : 's'}
                  </a>
                )}
                {org?.address && <span className="inline-flex items-center gap-1.5"><MapPin className="w-4 h-4 text-green-300" />{org.address}</span>}
              </div>
              <ul className="mt-4 flex flex-wrap gap-2">
                {perks.map(({ icon: Icon, text }) => (
                  <li key={text} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/20 bg-white/10 backdrop-blur text-xs sm:text-sm font-semibold text-white">
                    <Icon className="w-4 h-4 text-green-300" />{text}
                  </li>
                ))}
              </ul>
              {org && !org.accepting_bookings && (
                <p className="mt-3 inline-flex w-fit px-3 py-1 rounded-full bg-amber-400 text-amber-950 text-sm font-semibold">
                  Not taking new bookings right now
                </p>
              )}
            </>
          )}
          <StaySearch
            variant="glass"
            checkIn={checkIn}
            checkOut={checkOut}
            guests={guests}
            onSearch={(st) => setStay(st)}
            submitLabel="Check availability"
            className="mt-6"
          />
        </div>
      </section>

      {/* Rooms */}
      <section className={`${CONTAINER} mt-12`}>
        <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
          <div>
            <p className={EYEBROW}>Choose your room</p>
            <h2 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {activeProperty ? activeProperty.name : 'Rooms & Suites'}
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
                      ? 'bg-brand-500 text-white border-brand-500'
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
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[0, 1, 2].map(i => <div key={i} className="h-80 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />)}
          </div>
        ) : sortedRooms.length === 0 ? (
          <div className="flex flex-col items-center text-center py-16 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
            <SearchX className="w-10 h-10 text-slate-300 mb-3" />
            <p className="font-semibold text-slate-900 dark:text-white">No rooms match</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Try fewer guests{properties.length > 1 ? ' or another building' : ''}.</p>
          </div>
        ) : (
          <div className={`grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${loadingRooms ? 'opacity-60' : ''}`}>
            {sortedRooms.map(room => (
              <RoomCard key={room.id} room={room} checkIn={checkIn} checkOut={checkOut} to={`/book/${orgId}/rooms/${room.id}${query()}`} />
            ))}
          </div>
        )}
      </section>

      {/* Reviews */}
      {reviews.length > 0 && (
        <section id="reviews" className={`${CONTAINER} mt-16 scroll-mt-24`}>
          <p className={EYEBROW}>What guests say</p>
          <h2 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
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
                  <p className="mt-3 pl-3 border-l-2 border-brand-500 text-sm text-slate-600 dark:text-slate-300">
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
        <section className={`${CONTAINER} mt-16`}>
          <p className={EYEBROW}>Before you go</p>
          <h2 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-6">Good to Know</h2>
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
