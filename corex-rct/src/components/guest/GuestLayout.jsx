import React from 'react';
import SiteHeader from './SiteHeader';
import SiteFooter from './SiteFooter';
import GuestChat from './GuestChat';

/**
 * Shell for every public booking-site page: header, page content, footer.
 * `overlay` lets the page start with a full-bleed hero that the header
 * floats over; `bare` (log-in / sign-up) keeps the header to the brand only.
 */
const GuestLayout = ({ org = null, children, bare = false, overlay = false }) => (
  <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900">
    <SiteHeader org={org} overlay={overlay} bare={bare} />
    <main className="flex-1">{children}</main>
    <SiteFooter org={org} />
    <GuestChat org={org} />
  </div>
);

export default GuestLayout;
