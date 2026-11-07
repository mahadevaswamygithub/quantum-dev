/** Look-and-feel constants for the public booking site (/book…). */

export const SITE_NAME = 'CoreX Stays';

/** Page-width container: wide screens get a generous but not narrow column. */
export const CONTAINER = 'mx-auto w-full max-w-screen-2xl px-4 sm:px-6 lg:px-10';

/** Primary call-to-action (Search, Book now, Reserve…). */
export const BTN_PRIMARY =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-blue-500 hover:from-brand-600 hover:to-blue-600 text-white font-semibold shadow-sm shadow-green-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

/** Quiet secondary button. */
export const BTN_SECONDARY =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors';

/** Small all-caps eyebrow label above a section title. */
export const EYEBROW = 'text-xs font-bold uppercase tracking-[0.18em] text-brand-600 dark:text-brand-400';

/** Search query string for a stay (dates/guests), shared by every link that carries it along. */
export const stayQuery = ({ checkIn, checkOut, guests, destination } = {}) => {
  const p = new URLSearchParams();
  if (destination) p.set('q', destination);
  if (checkIn && checkOut) { p.set('check_in', checkIn); p.set('check_out', checkOut); }
  if (guests > 1) p.set('guests', String(guests));
  const s = p.toString();
  return s ? `?${s}` : '';
};
