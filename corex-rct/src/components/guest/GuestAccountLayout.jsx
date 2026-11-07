import React from 'react';
import SiteHeader from './SiteHeader';
import SiteFooter from './SiteFooter';
import GuestChat from './GuestChat';
import { CONTAINER } from './site';

/**
 * Signed-in guest pages (account home, trips, requests, wishlist, profile,
 * settings). Same header and footer as the rest of the booking site; the
 * pages are reached from the account (avatar) menu only, so there's no
 * second row of links here.
 */
const GuestAccountLayout = ({ children }) => (
  <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900">
    <SiteHeader />
    <main className={`${CONTAINER} flex-1 py-8`}>{children}</main>
    <SiteFooter />
    <GuestChat />
  </div>
);

export default GuestAccountLayout;
