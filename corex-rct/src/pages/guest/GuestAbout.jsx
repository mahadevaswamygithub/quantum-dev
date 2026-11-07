import React from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, Building2, CreditCard, ShieldCheck, Zap } from 'lucide-react';
import GuestLayout from '../../components/guest/GuestLayout';
import { BTN_PRIMARY, CONTAINER, EYEBROW, SITE_NAME } from '../../components/guest/site';

const POINTS = [
  { icon: BadgeCheck, title: 'Book direct', text: 'Every listing is managed by the property itself - the rooms, prices and availability you see come straight from their system.' },
  { icon: Zap, title: 'Live availability', text: 'Rooms update the moment they’re booked, so what you see free is really free.' },
  { icon: CreditCard, title: 'No booking fees', text: 'You pay the property’s own price. Pay online where offered, or at the property.' },
  { icon: ShieldCheck, title: 'Your data, your choice', text: 'Your details go only to the property you book, and you can delete your account at any time.' },
];

/** About the booking site. */
const GuestAbout = () => (
  <GuestLayout>
    <section className="bg-gradient-to-br from-green-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 border-b border-slate-200 dark:border-slate-800">
      <div className={`${CONTAINER} py-16 text-center max-w-3xl`}>
        <p className={EYEBROW}>About us</p>
        <h1 className="mt-2 text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white">Stays booked straight with the host</h1>
        <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">
          {SITE_NAME} brings together hotels, guest houses and resorts that run their bookings on CoreX - one account for guests, and every property in charge of its own rooms.
        </p>
      </div>
    </section>
    <div className={`${CONTAINER} py-14`}>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {POINTS.map(({ icon: Icon, title, text }) => (
          <div key={title} className="p-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <span className="w-11 h-11 rounded-xl bg-gradient-to-br from-green-400 to-blue-500 text-white flex items-center justify-center"><Icon className="w-5 h-5" /></span>
            <p className="mt-4 font-bold text-slate-900 dark:text-white">{title}</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{text}</p>
          </div>
        ))}
      </div>
      <div className="mt-12 p-8 rounded-3xl bg-slate-900 text-white flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Building2 className="w-10 h-10 text-green-300" />
          <div>
            <p className="text-xl font-bold">Run a property?</p>
            <p className="text-white/70">Manage rooms, bookings, payments and your own booking site with CoreX.</p>
          </div>
        </div>
        <Link to="/login" className={`${BTN_PRIMARY} h-11 px-6`}>Partner login</Link>
      </div>
    </div>
  </GuestLayout>
);

export default GuestAbout;
