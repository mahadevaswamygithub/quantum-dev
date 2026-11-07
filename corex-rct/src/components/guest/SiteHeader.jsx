import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { BedDouble, CalendarCheck, ChevronDown, FileClock, Heart, HelpCircle, Home, Info, LogOut, Menu, Moon, Settings, Sun, User, X } from 'lucide-react';
import NotificationsBell from './NotificationsBell';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import Avatar from '../common/Avatar';
import { useGuest } from './guestUtils';
import { CONTAINER, SITE_NAME } from './site';

/** Brand mark: the property's own logo + name on its pages, the site brand elsewhere. */
export const BrandMark = ({ org, light = false }) => (
  <Link to={org ? `/book/${org.id}` : '/book'} className="flex items-center gap-2.5 min-w-0">
    {org?.logo ? (
      <Avatar src={org.logo} className="w-9 h-9 rounded-lg ring-1 ring-white/20" />
    ) : (
      <span className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-400 to-blue-500 text-white flex items-center justify-center shadow-sm flex-shrink-0">
        <BedDouble className="w-5 h-5" />
      </span>
    )}
    {org ? (
      <span className={`font-bold truncate max-w-[14rem] ${light ? 'text-white' : 'text-slate-900 dark:text-white'}`}>{org.name}</span>
    ) : (
      <span className={`text-lg font-extrabold tracking-tight ${light ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
        {SITE_NAME.split(' ')[0]} <span className="text-brand-500">{SITE_NAME.split(' ').slice(1).join(' ')}</span>
      </span>
    )}
  </Link>
);

const useDismiss = (open, setOpen, ref) => {
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc); };
  }, [open, setOpen, ref]);
};

/** Light/dark switch: one obvious icon button in the header. */
export const ThemeButton = ({ light }) => {
  const { theme, setMode } = useTheme();
  const dark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={() => setMode(dark ? 'light' : 'dark')}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'}
      className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-colors ${
        light ? 'border-white/20 bg-white/10 text-white hover:bg-white/20' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-300'
      }`}
    >
      {dark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
    </button>
  );
};

const UserMenu = ({ user, onLogout, light }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useDismiss(open, setOpen, ref);
  const item = 'flex items-center gap-2.5 w-full px-3 py-2 text-sm rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full border transition-colors ${
          light ? 'border-white/25 bg-white/10 hover:bg-white/20 text-white' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
        }`}
      >
        <Avatar
          src={user.profile_picture}
          initials={`${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase() || 'G'}
          className="w-8 h-8 rounded-full text-xs"
          bg="bg-gradient-to-br from-brand-400 to-blue-500"
        />
        <span className="hidden sm:block text-sm font-semibold max-w-[8rem] truncate">{user.first_name || 'Account'}</span>
        <ChevronDown className={`w-4 h-4 opacity-70 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-60 p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl z-50">
          <div className="px-3 py-2 mb-1 border-b border-slate-100 dark:border-slate-700">
            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{user.first_name} {user.last_name}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
          </div>
          {[
            ['/book/me', Home, 'My account'],
            ['/book/me/trips', CalendarCheck, 'My trips'],
            ['/book/me/requests', FileClock, 'My requests'],
            ['/book/me/wishlist', Heart, 'Wishlist'],
            ['/book/me/profile', User, 'My profile'],
            ['/book/me/settings', Settings, 'Settings'],
          ].map(([to, Icon, label]) => (
            <Link key={to} role="menuitem" to={to} className={item} onClick={() => setOpen(false)}><Icon className="w-4 h-4" /> {label}</Link>
          ))}
          <div className="my-1 border-t border-slate-100 dark:border-slate-700" />
          <Link role="menuitem" to="/book/help" className={item} onClick={() => setOpen(false)}><HelpCircle className="w-4 h-4" /> Help &amp; support</Link>
          <Link role="menuitem" to="/book/about" className={item} onClick={() => setOpen(false)}><Info className="w-4 h-4" /> About CoreX Stays</Link>
          <div className="my-1 border-t border-slate-100 dark:border-slate-700" />
          <button role="menuitem" type="button" className={`${item} text-red-600 dark:text-red-400`} onClick={onLogout}>
            <LogOut className="w-4 h-4" /> Log out
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * Top bar of the public booking site. `overlay` floats a glass bar over a
 * full-bleed hero photo (landing and property pages); otherwise it's a
 * sticky white bar. `bare` (log-in / sign-up) shows the brand only.
 */
const SiteHeader = ({ org = null, overlay = false, bare = false }) => {
  const { user, isGuest } = useGuest();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const next = encodeURIComponent(location.pathname + location.search);
  const authBase = org ? `/book/${org.id}` : '/book';

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  // Over a hero photo the bar floats; once the page scrolls it stays pinned
  // and turns more solid so it reads over light sections too.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    if (!overlay) return undefined;
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [overlay]);

  const links = [
    { to: '/book', label: 'Home', end: true },
    { to: '/book/stays', label: 'Stays' },
  ];

  const linkCls = ({ isActive }) => `px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
    overlay
      ? (isActive ? 'bg-white/15 text-green-200' : 'text-white/85 hover:text-white hover:bg-white/10')
      : (isActive ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800')
  }`;

  const handleLogout = () => {
    logout();
    navigate('/book');
  };

  const bar = (
    <div className="h-16 flex items-center justify-between gap-4">
      <BrandMark org={org} light={overlay} />
      {bare && <ThemeButton light={overlay} />}
      {!bare && (
        <>
          <nav aria-label="Main" className="hidden md:flex items-center gap-1">
            {links.map(l => <NavLink key={l.to} to={l.to} end={l.end} className={linkCls}>{l.label}</NavLink>)}
          </nav>
          <div className="flex items-center gap-2">
            <ThemeButton light={overlay} />
            {isGuest && <NotificationsBell light={overlay} />}
            {isGuest ? (
              <UserMenu user={user} onLogout={handleLogout} light={overlay} />
            ) : (
              <>
                <Link to={`${authBase}/login?next=${next}`} className={`hidden sm:block px-3 py-2 text-sm font-semibold ${overlay ? 'text-white/90 hover:text-white' : 'text-slate-700 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white'}`}>
                  Log in
                </Link>
                <Link to={`${authBase}/register?next=${next}`} className="px-4 py-2 text-sm font-semibold rounded-xl bg-gradient-to-r from-brand-500 to-blue-500 hover:from-brand-600 hover:to-blue-600 text-white shadow-sm">
                  Sign up
                </Link>
              </>
            )}
            <button
              type="button"
              onClick={() => setMobileOpen(o => !o)}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
              className={`md:hidden p-2 rounded-lg ${overlay ? 'text-white hover:bg-white/10' : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'}`}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </>
      )}
    </div>
  );

  const mobileMenu = mobileOpen && !bare && (
    <nav aria-label="Main" className="md:hidden mt-2 p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl">
      {links.map(l => (
        <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => `block px-3 py-2.5 rounded-lg text-sm font-semibold ${isActive ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300' : 'text-slate-700 dark:text-slate-200'}`}>
          {l.label}
        </NavLink>
      ))}
      {!isGuest && (
        <Link to={`${authBase}/login?next=${next}`} className="block px-3 py-2.5 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-200">Log in</Link>
      )}
    </nav>
  );

  if (overlay) {
    return (
      <header className={`fixed inset-x-0 top-0 z-40 transition-[padding] duration-300 ${scrolled ? 'pt-2' : 'pt-4'}`}>
        <div className={CONTAINER}>
          <div className={`px-4 sm:px-5 rounded-2xl border backdrop-blur-xl transition-colors duration-300 ${scrolled ? 'border-white/10 bg-navy-950/85 shadow-xl shadow-black/30' : 'border-white/15 bg-navy-950/40 shadow-lg shadow-black/20'}`}>
            {bar}
          </div>
          {mobileMenu}
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md">
      <div className={CONTAINER}>
        {bar}
        {mobileMenu && <div className="pb-3">{mobileMenu}</div>}
      </div>
    </header>
  );
};

export default SiteHeader;
