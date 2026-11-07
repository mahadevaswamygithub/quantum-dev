import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight, BadgeCheck, BedDouble, CalendarCheck, ChevronLeft, ChevronRight, CreditCard, MapPin, Search, ShieldCheck, Zap,
} from 'lucide-react';
import GuestLayout from '../components/guest/GuestLayout';
import StaySearch from '../components/guest/StaySearch';
import { StayCard, shortPlace } from '../components/guest/StayCards';
import { addDaysISO, todayISO } from '../components/guest/guestUtils';
import { BTN_PRIMARY, CONTAINER, EYEBROW, stayQuery } from '../components/guest/site';
import TechBackdrop from '../components/guest/TechBackdrop';
import { bookingAPI } from '../services/api';
import heroBg from '../assets/hero-bg.jpg';

const byRating = (a, b) => (b.rating_avg || 0) - (a.rating_avg || 0) || b.rating_count - a.rating_count;

/** Horizontal, snap-scrolling row of cards with prev/next buttons. */
const Carousel = ({ eyebrow, title, subtitle, items, renderItem, moreTo }) => {
  const ref = useRef(null);
  const scroll = (dir) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: 'smooth' });
  };
  const arrow = 'w-11 h-11 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-brand-400 hover:text-brand-600 flex items-center justify-center shadow-sm transition-colors';

  return (
    <section className={`${CONTAINER} mt-16`}>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          {eyebrow && <p className={EYEBROW}>{eyebrow}</p>}
          <h2 className="mt-1 text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">{title}</h2>
          {subtitle && <p className="mt-2 text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {moreTo && (
            <Link to={moreTo} className="mr-2 hidden sm:inline-flex items-center gap-1 text-sm font-semibold text-brand-700 dark:text-brand-400 hover:underline">
              View all <ArrowRight className="w-4 h-4" />
            </Link>
          )}
          {items.length > 4 && (
            <>
              <button type="button" aria-label="Scroll left" onClick={() => scroll(-1)} className={arrow}><ChevronLeft className="w-5 h-5" /></button>
              <button type="button" aria-label="Scroll right" onClick={() => scroll(1)} className={arrow}><ChevronRight className="w-5 h-5" /></button>
            </>
          )}
        </div>
      </div>
      <div ref={ref} className="-mx-2 px-2 pb-4 flex gap-6 overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map(item => (
          <div key={item.id} className="snap-start flex-shrink-0 w-[85%] sm:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)] xl:w-[calc(25%-18px)]">
            {renderItem(item)}
          </div>
        ))}
      </div>
    </section>
  );
};

const TRUST = [
  { icon: BadgeCheck, title: 'Book direct', text: 'Every stay is listed and run by the property itself.' },
  { icon: Zap, title: 'Live availability', text: 'See exactly which rooms are free for your dates.' },
  { icon: CreditCard, title: 'Pay your way', text: 'Pay securely online, or at the property where offered.' },
  { icon: ShieldCheck, title: 'No booking fees', text: 'The price you see is the price the property charges.' },
];

const STEPS = [
  { icon: Search, title: 'Search', text: 'Pick your dates and guests, and compare places to stay.' },
  { icon: CalendarCheck, title: 'Reserve', text: 'Choose a room and book in a minute with one account for every property.' },
  { icon: BedDouble, title: 'Stay', text: 'Get your confirmation by email, download it anytime, and check in.' },
];

/**
 * Landing page of the booking site: full-screen photo hero with the stay
 * search, then curated rows of properties, how it works, and the footer.
 */
const BookingHome = () => {
  const navigate = useNavigate();
  const [stays, setStays] = useState(null);

  useEffect(() => {
    bookingAPI.getPublicOrgList()
      .then(({ data }) => setStays(data || []))
      .catch(() => setStays([]));
  }, []);

  const list = useMemo(() => stays || [], [stays]);
  const topRated = useMemo(() => [...list].sort(byRating).slice(0, 12), [list]);
  const bestValue = useMemo(() => [...list].sort((a, b) => Number(a.min_price) - Number(b.min_price)).slice(0, 12), [list]);

  // Quick-pick places from the properties' addresses.
  const places = useMemo(() => [...new Set(list.map(st => shortPlace(st.address)).filter(Boolean))].slice(0, 6), [list]);

  const search = (s) => navigate(`/book/stays${stayQuery(s)}`);
  const stayLink = (s) => `/book/${s.id}`;

  return (
    <GuestLayout overlay>
      {/* Search-first hero */}
      <section className="relative min-h-[600px] h-[78vh] max-h-[820px] flex items-center">
        <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
          <img src={heroBg} alt="" className="w-full h-full object-cover object-center" />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/50 via-slate-950/15 to-slate-950/55" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_45%_at_center,rgba(2,6,23,0.55),transparent_75%)]" />
        </div>
        <div className={`${CONTAINER} relative pt-24 pb-10 text-center`}>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white drop-shadow-lg animate-rise-in motion-reduce:animate-none">
            Where do you want to stay?
          </h1>
          <p className="mt-4 text-white/90 sm:text-lg drop-shadow animate-rise-in motion-reduce:animate-none [animation-delay:120ms]">
            Handpicked hotels, resorts and homestays - booked straight with the people who run them.
          </p>
          <StaySearch
            variant="pill"
            withDestination
            requireDestination
            checkIn={todayISO()}
            checkOut={addDaysISO(todayISO(), 1)}
            onSearch={search}
            className="mt-8 max-w-5xl mx-auto text-left relative z-10 animate-rise-in motion-reduce:animate-none [animation-delay:240ms]"
          />
          {places.length > 0 && (
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2 animate-rise-in motion-reduce:animate-none [animation-delay:360ms]">
              {places.map(pl => (
                <Link key={pl} to={`/book/stays?q=${encodeURIComponent(pl)}`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-white/25 bg-white/15 backdrop-blur text-sm font-medium text-white hover:bg-white/25 transition-colors">
                  <MapPin className="w-3.5 h-3.5" />{pl}
                </Link>
              ))}
              <Link to="/book/stays" className="inline-flex items-center gap-1 px-4 py-2 rounded-full text-sm font-semibold text-white hover:underline">
                All stays <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Property rows */}
      {!stays ? (
        <section className={`${CONTAINER} mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`}>
          {[0, 1, 2, 3].map(i => <div key={i} className="h-[26rem] rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />)}
        </section>
      ) : list.length === 0 ? (
        <section className={`${CONTAINER} mt-16`}>
          <div className="flex flex-col items-center text-center py-16 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
            <BedDouble className="w-10 h-10 text-slate-300 mb-3" />
            <p className="font-semibold text-slate-900 dark:text-white">No properties are taking bookings yet</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Check back soon.</p>
          </div>
        </section>
      ) : (
        <>
          <Carousel
            eyebrow="Loved by guests"
            title="Top Rated Stays"
            subtitle="Hand-picked favourites, ranked by real guest reviews."
            items={topRated}
            moreTo="/book/stays?sort=rating"
            renderItem={s => <StayCard stay={s} to={stayLink(s)} />}
          />
          {list.length > 3 && (
            <Carousel
              eyebrow="Great value"
              title="Stays for Every Budget"
              subtitle="Comfortable rooms at the lowest nightly prices."
              items={bestValue}
              moreTo="/book/stays?sort=price"
              renderItem={s => <StayCard stay={s} to={stayLink(s)} />}
            />
          )}
        </>
      )}

      {/* Why book here */}
      <section className="relative mt-16">
        <div className={CONTAINER}>
          <div className="grid gap-px overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-200 dark:bg-slate-700 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
            {TRUST.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex gap-3.5 p-5 bg-white dark:bg-slate-800">
                <span className="w-11 h-11 rounded-xl bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center flex-shrink-0"><Icon className="w-5 h-5" /></span>
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">{title}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className={`${CONTAINER} mt-20`}>
        <div className="text-center">
          <p className={EYEBROW}>Simple from start to finish</p>
          <h2 className="mt-1 text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">How It Works</h2>
        </div>
        <ol className="mt-10 grid gap-6 md:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="relative p-7 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <span className="absolute top-5 right-6 text-5xl font-black text-slate-100 dark:text-slate-700/60 select-none">0{i + 1}</span>
              <span className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-brand-400 to-blue-500 text-white flex items-center justify-center shadow-lg shadow-green-500/20"><Icon className="w-6 h-6" /></span>
              <h3 className="relative mt-5 text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
              <p className="relative mt-1 text-slate-500 dark:text-slate-400">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Call to action */}
      <section className={`${CONTAINER} mt-20`}>
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-navy-900 to-navy-700 px-6 py-12 sm:px-12 flex flex-col lg:flex-row items-center justify-between gap-6">
          <TechBackdrop intensity="soft" />
          <div className="relative text-center lg:text-left">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">Ready for your next getaway?</h2>
            <p className="mt-2 text-white/70">Browse every property and see what’s free for your dates.</p>
          </div>
          <Link to="/book/stays" className={`${BTN_PRIMARY} relative h-12 px-8 text-base`}>
            Explore all stays <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </GuestLayout>
  );
};

export default BookingHome;
