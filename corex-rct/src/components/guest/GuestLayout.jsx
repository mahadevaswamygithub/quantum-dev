import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BedDouble, CalendarCheck, ChevronDown, Clock, Home, LayoutGrid, LogOut, Mail, MapPin, Phone, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Avatar from '../common/Avatar';
import ThemeToggle from '../ThemeToggle';
import { formatTime, useGuest } from './guestUtils';
import GuestAccountLayout from './GuestAccountLayout';

const UserMenu = ({ user, onLogout }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  const item = 'flex items-center gap-2.5 w-full px-3 py-2 text-sm rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow bg-white dark:bg-slate-800"
      >
        <Avatar
          src={user.profile_picture}
          initials={`${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase() || 'G'}
          className="w-8 h-8 rounded-full text-xs"
        />
        <span className="hidden sm:block text-sm font-medium text-slate-700 dark:text-slate-200 max-w-[8rem] truncate">{user.first_name || 'Account'}</span>
        <ChevronDown className="w-4 h-4 text-slate-400" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-60 p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl z-50">
          <div className="px-3 py-2 mb-1 border-b border-slate-100 dark:border-slate-700">
            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{user.first_name} {user.last_name}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
          </div>
          <Link role="menuitem" to="/book/me" className={item} onClick={() => setOpen(false)}>
            <Home className="w-4 h-4" /> My account
          </Link>
          <Link role="menuitem" to="/book/me/trips" className={item} onClick={() => setOpen(false)}>
            <CalendarCheck className="w-4 h-4" /> My trips
          </Link>
          <Link role="menuitem" to="/book/me/profile" className={item} onClick={() => setOpen(false)}>
            <User className="w-4 h-4" /> Profile
          </Link>
          <button role="menuitem" type="button" className={`${item} text-red-600 dark:text-red-400`} onClick={onLogout}>
            <LogOut className="w-4 h-4" /> Log out
          </button>
        </div>
      )}
    </div>
  );
};

const Footer = ({ org }) => (
  <footer className="mt-12 border-t border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
    <div className="px-4 sm:px-6 lg:px-8 py-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-500 dark:text-slate-400">
      <span className="font-semibold text-slate-700 dark:text-slate-200">{org?.name}</span>
      {org?.address && <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" />{org.address}</span>}
      {org?.contact_phone && <a href={`tel:${org.contact_phone}`} className="flex items-center gap-1.5 hover:text-slate-800 dark:hover:text-white"><Phone className="w-4 h-4" />{org.contact_phone}</a>}
      {org?.contact_email && <a href={`mailto:${org.contact_email}`} className="flex items-center gap-1.5 hover:text-slate-800 dark:hover:text-white"><Mail className="w-4 h-4" />{org.contact_email}</a>}
      {org?.check_in_time && <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" />Check-in {formatTime(org.check_in_time)} · Check-out {formatTime(org.check_out_time)}</span>}
      <span className="sm:ml-auto">Powered by CoreX · <Link to="/book" className="hover:underline">Other properties</Link></span>
    </div>
  </footer>
);

/**
 * Shell for every page of a property's public booking site: sticky header
 * (brand, account menu or log-in/sign-up) and a footer with contact and
 * stay details. Pages lay out their own content inside `main`.
 */
const GuestLayout = ({ org, children, bare = false }) => {
  const { orgId, user, isGuest } = useGuest();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const next = encodeURIComponent(location.pathname + location.search);
  // Property pages live under /book/:orgId; the directory and account pages don't.
  const base = orgId ? `/book/${orgId}` : '/book';

  const handleLogout = () => {
    logout();
    navigate(base);
  };

  // Signed-in guests browse inside their account shell (same top bar and
  // sidebar as My trips), so moving between "Find a stay", a property and
  // their trips never switches to a different-looking site.
  if (isGuest && !bare) {
    return (
      <GuestAccountLayout flush>
        {children}
        {org && <Footer org={org} />}
      </GuestAccountLayout>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900">
      <header className="sticky top-0 z-40 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
          <Link to={base} className="flex items-center gap-2.5 min-w-0">
            <Avatar src={org?.logo} icon={BedDouble} className="w-9 h-9 rounded-lg" bg="bg-green-600" />
            <span className="font-bold text-slate-900 dark:text-white truncate">{org?.name || 'Book a stay'}</span>
          </Link>
          {!bare && (
            <nav className="flex items-center gap-1 sm:gap-2">
              {orgId && <Link to="/book" title="All properties" className="flex items-center gap-1.5 px-2 md:px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white">
                <LayoutGrid className="w-4 h-4" /><span className="hidden md:inline">All properties</span>
              </Link>}
              {!orgId && isGuest && (
                <Link to="/book/me/trips" className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white">
                  <CalendarCheck className="w-4 h-4" />My trips
                </Link>
              )}
              <ThemeToggle className="hidden sm:flex" />
              {isGuest ? (
                <UserMenu user={user} onLogout={handleLogout} />
              ) : (
                <>
                  <Link to={`${base}/login?next=${next}`} className="px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white">
                    Log in
                  </Link>
                  <Link to={`${base}/register?next=${next}`} className="px-4 py-2 text-sm font-semibold rounded-full bg-green-600 hover:bg-green-700 text-white">
                    Sign up
                  </Link>
                </>
              )}
            </nav>
          )}
        </div>
      </header>
      <main className="flex-1">{children}</main>
      {org ? <Footer org={org} /> : (
        <footer className="mt-12 border-t border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
          <p className="px-4 sm:px-6 lg:px-8 py-5 text-sm text-slate-500 dark:text-slate-400">© {new Date().getFullYear()} · Bookings powered by CoreX</p>
        </footer>
      )}
    </div>
  );
};

export default GuestLayout;
