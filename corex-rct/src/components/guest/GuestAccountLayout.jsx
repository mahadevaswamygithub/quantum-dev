import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  BedDouble, CalendarCheck, ChevronDown, ChevronLeft, ChevronRight, Home, LayoutGrid, LogOut, User,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Avatar from '../common/Avatar';
import ThemeToggle from '../ThemeToggle';
import { useGuest } from './guestUtils';

/**
 * Signed-in guest area (Home, My trips, Profile). Deliberately the same
 * shell as the staff portal (Navbar + Sidebar + full-width `p-6` content)
 * so the whole product looks like one app.
 */
const GuestAccountLayout = ({ children, flush = false }) => {
  const { user } = useGuest();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const items = [
    { to: '/book/me', label: 'Home', icon: Home },
    { to: '/book/me/trips', label: 'My trips', icon: CalendarCheck },
    // Active on the directory and on any property / room page.
    { to: '/book', label: 'Find a stay', icon: LayoutGrid, match: (p) => p === '/book' || (p.startsWith('/book/') && !p.startsWith('/book/me')) },
  ];
  // Profile and log out live in the account menu (top right), like the staff portal.
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  useEffect(() => {
    if (!menuOpen) return undefined;
    const close = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc); };
  }, [menuOpen]);

  const isActive = ({ to, match }) => (match ? match(location.pathname) : location.pathname === to);

  const NavItem = ({ to, label, icon: Icon, onClick, match }) => {
    const active = isActive({ to, match });
    return (
      <button
        type="button"
        onClick={onClick || (() => navigate(to))}
        title={collapsed ? label : ''}
        className={`group relative flex w-full items-center gap-3 rounded-lg py-2.5 pl-4 pr-3 text-left transition-all duration-150 ${
          active
            ? 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700/60 dark:hover:text-white'
        }`}
      >
        {active && <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-green-500" />}
        <Icon className="w-[18px] h-[18px] flex-shrink-0" />
        {!collapsed && <span className="truncate text-sm font-medium">{label}</span>}
      </button>
    );
  };

  const handleLogout = () => {
    logout();
    navigate('/book');
  };

  return (
    <div className="h-screen overflow-hidden bg-slate-50 dark:bg-slate-900 flex flex-col">
      {/* Top bar — same as the staff Navbar */}
      <header className="flex-shrink-0 border-b border-slate-200 bg-white px-4 sm:px-6 py-3 dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={() => navigate('/book/me')} className="flex items-center gap-3 min-w-0 text-left">
            <span className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 text-white flex items-center justify-center"><BedDouble className="w-5 h-5" /></span>
            <div className="min-w-0">
              <p className="text-lg font-bold text-slate-900 dark:text-white truncate">Book a stay</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Your account</p>
            </div>
          </button>
          <div className="flex items-center gap-3">
            <ThemeToggle className="hidden sm:flex" />
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen(o => !o)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className="flex items-center gap-2 rounded-lg bg-slate-100 py-1.5 pl-2 pr-3 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 transition-colors"
              >
                <Avatar
                  src={user?.profile_picture}
                  initials={`${user?.first_name?.[0] || ''}${user?.last_name?.[0] || ''}`.toUpperCase() || 'G'}
                  className="w-8 h-8 rounded-full text-xs"
                />
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-medium text-slate-900 dark:text-white leading-tight">{user?.first_name} {user?.last_name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-tight">{user?.email}</p>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
              </button>
              {menuOpen && (
                <div role="menu" className="absolute right-0 mt-2 w-48 p-1.5 rounded-xl border border-slate-200 bg-white shadow-xl z-50 dark:border-slate-700 dark:bg-slate-800">
                  <button role="menuitem" type="button" onClick={() => { setMenuOpen(false); navigate('/book/me/profile'); }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700">
                    <User className="w-4 h-4" /> Profile
                  </button>
                  <button role="menuitem" type="button" onClick={handleLogout}
                    className="flex w-full items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10">
                    <LogOut className="w-4 h-4" /> Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar — same as the staff Sidebar (hidden on small screens) */}
        <aside className={`hidden lg:flex h-full flex-shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'}`}>
          <div className={`flex ${collapsed ? 'justify-center' : 'justify-end'} border-b border-slate-100 p-2 dark:border-slate-700/50`}>
            <button
              type="button"
              onClick={() => setCollapsed(c => !c)}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-700 dark:hover:text-white"
            >
              {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>
          <nav aria-label="Your account" className="flex-1 space-y-1 overflow-y-auto p-2">
            {items.map(i => <NavItem key={i.to} {...i} />)}
          </nav>
        </aside>

        <main className="flex-1 overflow-y-auto min-h-0">
          {/* Small screens: the sidebar becomes a tab row */}
          <nav aria-label="Your account" className="lg:hidden flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-4 py-2 dark:border-slate-700 dark:bg-slate-800">
            {items.map(({ to, label, icon: Icon, match }) => {
              const active = isActive({ to, match });
              return (
                <button key={to} type="button" onClick={() => navigate(to)}
                  className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${
                    active ? 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400' : 'text-slate-600 dark:text-slate-300'
                  }`}>
                  <Icon className="w-4 h-4" />{label}
                </button>
              );
            })}
          </nav>
          {flush ? children : <div className="p-4 sm:p-6">{children}</div>}
        </main>
      </div>
    </div>
  );
};

export default GuestAccountLayout;
