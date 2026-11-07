import React from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, BedDouble, Clock, Mail, MapPin, Phone } from 'lucide-react';
import { formatTime, useGuest } from './guestUtils';
import { CONTAINER, SITE_NAME } from './site';
import TechBackdrop from './TechBackdrop';

const Column = ({ title, children }) => (
  <div>
    <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-green-300">{title}</h3>
    <span className="mt-2 block w-8 h-0.5 rounded-full bg-gradient-to-r from-green-400 to-blue-500" />
    <ul className="mt-5 space-y-3 text-sm">{children}</ul>
  </div>
);

const FLink = ({ to, children }) => (
  <li><Link to={to} className="text-slate-300 hover:text-white transition-colors">{children}</Link></li>
);

const Contact = ({ icon: Icon, children, href }) => {
  const body = <><Icon className="w-4 h-4 mt-0.5 text-green-300 flex-shrink-0" /><span>{children}</span></>;
  return (
    <li>
      {href
        ? <a href={href} className="flex gap-2.5 text-slate-300 hover:text-white break-all">{body}</a>
        : <span className="flex gap-2.5 text-slate-300">{body}</span>}
    </li>
  );
};

/**
 * Site footer. On a property's pages the first column is that property's
 * contact details; elsewhere it's the site's own blurb.
 */
const SiteFooter = ({ org = null }) => {
  const { isGuest } = useGuest();
  const authBase = org ? `/book/${org.id}` : '/book';

  return (
    <footer className="relative overflow-hidden mt-16 bg-navy-950 text-slate-300">
      <TechBackdrop grid={false} intensity="soft" />
      <div className={`${CONTAINER} relative py-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]`}>
        <div className="lg:pr-8 lg:border-r lg:border-white/10">
          <Link to={org ? `/book/${org.id}` : '/book'} className="inline-flex items-center gap-2.5">
            <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-400 to-blue-500 text-white flex items-center justify-center"><BedDouble className="w-5 h-5" /></span>
            <span className="text-xl font-extrabold text-white">{org?.name || SITE_NAME}</span>
          </Link>
          {org ? (
            <ul className="mt-6 space-y-3 text-sm">
              {org.address && <Contact icon={MapPin}>{org.address}</Contact>}
              {org.contact_phone && <Contact icon={Phone} href={`tel:${org.contact_phone}`}>{org.contact_phone}</Contact>}
              {org.contact_email && <Contact icon={Mail} href={`mailto:${org.contact_email}`}>{org.contact_email}</Contact>}
              {org.check_in_time && <Contact icon={Clock}>Check-in from {formatTime(org.check_in_time)} · Check-out by {formatTime(org.check_out_time)}</Contact>}
            </ul>
          ) : (
            <p className="mt-5 text-sm leading-relaxed text-slate-400 max-w-sm">
              Book hotels, guest houses and resorts directly with the property - real rooms, live availability and no booking fees.
            </p>
          )}
        </div>

        <Column title="Explore stays">
          <FLink to="/book/stays">All stays</FLink>
          <FLink to="/book/stays?sort=rating">Top rated</FLink>
          <FLink to="/book/stays?sort=price">Lowest price</FLink>
          {org && <FLink to="/book">Other properties</FLink>}
        </Column>

        <Column title="Your account">
          {isGuest ? (
            <>
              <FLink to="/book/me">My account</FLink>
              <FLink to="/book/me/trips">My trips</FLink>
              <FLink to="/book/me/wishlist">Wishlist</FLink>
              <FLink to="/book/me/profile">Profile &amp; privacy</FLink>
            </>
          ) : (
            <>
              <FLink to={`${authBase}/login`}>Log in</FLink>
              <FLink to={`${authBase}/register`}>Create an account</FLink>
              <FLink to={`${authBase}/login?next=${encodeURIComponent('/book/me/trips')}`}>My trips</FLink>
            </>
          )}
        </Column>

        <Column title="Help & company">
          <FLink to="/book/help">Help &amp; support</FLink>
          <FLink to="/book/about">About {SITE_NAME}</FLink>
          <FLink to="/login">Partner login</FLink>
          <li className="flex items-start gap-2 text-slate-400"><BadgeCheck className="w-4 h-4 mt-0.5 text-green-300 flex-shrink-0" />Every listing is run by the property itself</li>
        </Column>
      </div>

      <div className="relative border-t border-white/10">
        <div className={`${CONTAINER} py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400`}>
          <p>© {new Date().getFullYear()} {SITE_NAME}{org ? ` · Bookings for ${org.name}` : ''} · Powered by CoreX</p>
          <p>Book direct · No booking fees · Secure payments</p>
        </div>
      </div>
    </footer>
  );
};

export default SiteFooter;
