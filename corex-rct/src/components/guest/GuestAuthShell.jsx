import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CalendarCheck, Eye, EyeOff, Globe2, Loader2, ShieldCheck, Star, Zap } from 'lucide-react';
import { bookingAPI } from '../../services/api';
import { BrandMark, ThemeButton } from './SiteHeader';
import TechBackdrop from './TechBackdrop';
import { BTN_PRIMARY } from './site';

const PERKS = [
  { icon: Globe2, title: 'One account, every property', text: 'Sign up once and book anywhere on the site.' },
  { icon: Zap, title: 'Live rooms, instant answers', text: 'See what’s free for your dates and get confirmed fast.' },
  { icon: CalendarCheck, title: 'All your trips in one place', text: 'Pay, cancel, rate your stay and download confirmations.' },
  { icon: ShieldCheck, title: 'Your data stays yours', text: 'Shared only with the property you book. Delete anytime.' },
];

// A photo for the side panel when we're not on a specific property's link.
let photoPromise = null;
const loadPhoto = () => {
  photoPromise = photoPromise || bookingAPI.getPublicOrgList()
    .then(({ data }) => [...(data || [])]
      .sort((a, b) => (b.rating_avg || 0) - (a.rating_avg || 0))
      .find(s => s.cover_image)?.cover_image || null)
    .catch(() => null);
  return photoPromise;
};

/**
 * Split-screen frame for guest log-in / sign-up: a dark photo panel with
 * what you get (property-branded when the link is for one property) and
 * the form on the right.
 */
export const GuestAuthShell = ({ org, title, subtitle, error, children, footer, backTo }) => {
  const [photo, setPhoto] = useState(null);
  useEffect(() => {
    if (org?.cover_image) { setPhoto(org.cover_image); return undefined; }
    let cancelled = false;
    loadPhoto().then(p => { if (!cancelled) setPhoto(p); });
    return () => { cancelled = true; };
  }, [org]);

  return (
    <div className="min-h-screen grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] bg-slate-50 dark:bg-slate-900">
      {/* Showcase panel */}
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-navy-950 p-10 xl:p-14">
        {photo && <img src={photo} alt="" className="absolute inset-0 w-full h-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-br from-navy-950/90 via-navy-950/70 to-navy-950/85" />
        <TechBackdrop />

        <div className="relative"><BrandMark org={org} light /></div>

        <div className="relative max-w-lg">
          <p className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/15 bg-white/10 backdrop-blur text-xs font-semibold text-green-200">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> Book direct · No booking fees
          </p>
          <h2 className="mt-5 text-4xl xl:text-5xl font-extrabold tracking-tight text-white leading-[1.1]">
            {org ? <>Your stay at <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-300 to-blue-400">{org.name}</span> starts here</>
              : <>Your next <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-300 to-blue-400">getaway</span> starts here</>}
          </h2>
          {org?.rating_count > 0 && (
            <p className="mt-4 inline-flex items-center gap-2 text-sm text-white/80">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-600 text-white font-bold"><Star className="w-3.5 h-3.5 fill-white" />{org.rating_avg}</span>
              rated by {org.rating_count} guest{org.rating_count === 1 ? '' : 's'}
            </p>
          )}
          <ul className="mt-8 grid gap-3">
            {PERKS.map(({ icon: Icon, title: t, text }) => (
              <li key={t} className="flex gap-4 p-4 rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-md">
                <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-400 to-blue-500 text-white flex items-center justify-center flex-shrink-0 shadow-lg shadow-green-500/20"><Icon className="w-5 h-5" /></span>
                <div>
                  <p className="font-semibold text-white">{t}</p>
                  <p className="text-sm text-white/65">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/50">© {new Date().getFullYear()} CoreX Stays · Secure sign-in</p>
      </aside>

      {/* Form */}
      <main className="relative flex flex-col min-h-screen">
        <div className="flex items-center justify-between gap-3 px-5 sm:px-8 h-16">
          <div className="lg:hidden"><BrandMark org={org} /></div>
          <Link to={backTo} className="hidden lg:inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
            <ArrowLeft className="w-4 h-4" /> Back to stays
          </Link>
          <ThemeButton />
        </div>

        <div className="flex-1 flex items-center justify-center px-5 sm:px-8 py-8">
          <div className="w-full max-w-md">
            <span className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-400 to-blue-500 text-white text-lg font-extrabold flex items-center justify-center shadow-lg shadow-green-500/25">CX</span>
            <h1 className="mt-6 text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">{title}</h1>
            {subtitle && <p className="mt-2 text-slate-500 dark:text-slate-400">{subtitle}</p>}
            {error && (
              <div role="alert" className="mt-6 p-3.5 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-sm text-red-700 dark:text-red-300 flex gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />{error}
              </div>
            )}
            <div className="mt-8">{children}</div>
            {footer && <p className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 text-center text-sm text-slate-600 dark:text-slate-300">{footer}</p>}
          </div>
        </div>
      </main>
    </div>
  );
};

const boxCls = 'flex items-center gap-3 h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 shadow-sm transition-all focus-within:border-green-500 focus-within:ring-4 focus-within:ring-green-500/15';
const inputCls = 'w-full min-w-0 bg-transparent text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none';

/** Labelled input with a leading icon. `aside` sits to the right of the label (e.g. "Forgot password?"). */
export const AuthField = ({ label, icon: Icon, hint, aside, id, ...input }) => (
  <div>
    <div className="flex items-center justify-between mb-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-slate-700 dark:text-slate-200">
        {label}{hint && <span className="ml-1 font-normal text-slate-400">{hint}</span>}
      </label>
      {aside}
    </div>
    <div className={boxCls}>
      <Icon className="w-[18px] h-[18px] text-slate-400 flex-shrink-0" />
      <input id={id} className={inputCls} {...input} />
    </div>
  </div>
);

const strength = (pw) => {
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (pw.length >= 12) score += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score += 1;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score += 1;
  return score;
};
const STRENGTH = [
  { label: 'Too short', cls: 'bg-red-500' }, { label: 'Weak', cls: 'bg-red-500' }, { label: 'Fair', cls: 'bg-amber-500' },
  { label: 'Good', cls: 'bg-green-500' }, { label: 'Strong', cls: 'bg-green-500' },
];

/** Password input with show/hide and (optionally) a strength meter. */
export const PasswordField = ({ label = 'Password', icon: Icon, aside, id, meter = false, value, ...input }) => {
  const [show, setShow] = useState(false);
  const s = strength(value || '');
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label htmlFor={id} className="text-sm font-semibold text-slate-700 dark:text-slate-200">{label}</label>
        {aside}
      </div>
      <div className={boxCls}>
        <Icon className="w-[18px] h-[18px] text-slate-400 flex-shrink-0" />
        <input id={id} type={show ? 'text' : 'password'} value={value} className={inputCls} {...input} />
        <button type="button" onClick={() => setShow(v => !v)} aria-label={show ? 'Hide password' : 'Show password'}
          className="p-1 -mr-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
          {show ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
        </button>
      </div>
      {meter && value && (
        <div className="mt-2 flex items-center gap-3">
          <div className="flex-1 grid grid-cols-4 gap-1.5">
            {[1, 2, 3, 4].map(i => <span key={i} className={`h-1.5 rounded-full ${i <= s ? STRENGTH[s].cls : 'bg-slate-200 dark:bg-slate-700'}`} />)}
          </div>
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 w-16 text-right">{value.length < 8 ? STRENGTH[0].label : STRENGTH[s].label}</span>
        </div>
      )}
    </div>
  );
};

export const AuthSubmit = ({ loading, children, loadingText }) => (
  <button type="submit" disabled={loading} className={`${BTN_PRIMARY} w-full h-12 text-base shadow-lg`}>
    {loading && <Loader2 className="w-4 h-4 animate-spin" />}{loading ? loadingText : children}
  </button>
);
