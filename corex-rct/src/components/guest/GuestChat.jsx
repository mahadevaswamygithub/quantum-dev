import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, BedDouble, CalendarDays, MessageCircle, RotateCcw, Send, Sparkles, Star, X } from 'lucide-react';
import { bookingAPI } from '../../services/api';
import { formatDate, formatMoney, useGuest } from './guestUtils';

const STORE_KEY = 'corex-guest-chat';
const WELCOME = {
  role: 'assistant',
  content: "Hi! 👋 I'm the CoreX Stays assistant. Ask me to find a stay, check free rooms for your dates, or about check-in, payment and cancellation.",
  suggestions: ['Find a stay', 'Rooms free tonight', 'My bookings', 'Cancellation policy'],
};

const load = () => {
  try { return JSON.parse(sessionStorage.getItem(STORE_KEY)) || [WELCOME]; } catch { return [WELCOME]; }
};
const save = (msgs) => {
  try { sessionStorage.setItem(STORE_KEY, JSON.stringify(msgs.slice(-40))); } catch { /* storage unavailable */ }
};

const StayMini = ({ s, query }) => (
  <Link to={`/book/${s.id}${query}`} className="group flex-shrink-0 w-44 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:shadow-md transition-shadow">
    <div className="relative h-20 bg-gradient-to-br from-slate-700 to-slate-800">
      {s.cover_image
        ? <img src={s.cover_image} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
        : <span className="absolute inset-0 flex items-center justify-center text-white/40"><BedDouble className="w-6 h-6" /></span>}
      {s.available_rooms != null && (
        <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-bold">{s.available_rooms} free</span>
      )}
    </div>
    <div className="p-2">
      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{s.name}</p>
      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{s.place || 'View details'}</p>
      <div className="mt-1 flex items-center justify-between text-[11px]">
        <span className="font-semibold text-slate-800 dark:text-slate-200">{formatMoney(s.min_price)}<span className="font-normal text-slate-400">/night</span></span>
        {s.rating_count > 0 && <span className="inline-flex items-center gap-0.5 text-slate-600 dark:text-slate-300"><Star className="w-3 h-3 fill-amber-400 text-amber-400" />{s.rating_avg}</span>}
      </div>
    </div>
  </Link>
);

const BookingMini = ({ b }) => (
  <Link to="/book/me/trips" className="block p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-green-400 transition-colors">
    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{b.property} · {b.room}</p>
    <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
      <CalendarDays className="w-3 h-3" />{formatDate(b.check_in)} → {formatDate(b.check_out)}
    </p>
    <p className="mt-1 flex items-center justify-between text-[11px]">
      <span className="font-semibold text-slate-700 dark:text-slate-200">{b.status_label}</span>
      {Number(b.balance_due) > 0 ? <span className="text-amber-600 dark:text-amber-400">{formatMoney(b.balance_due)} due</span> : <span className="text-emerald-600 dark:text-emerald-400">Paid</span>}
    </p>
  </Link>
);

/**
 * Floating chat assistant for the booking site - open to everyone. Answers
 * come from POST /bookings/assistant/ (built-in helper + private LLM).
 * The conversation lives in sessionStorage for this tab only.
 */
const GuestChat = ({ org = null }) => {
  const { user } = useGuest();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(load);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { save(messages); }, [messages]);
  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      const el = listRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, [open, messages, busy]);
  useEffect(() => {
    if (!open) return undefined;
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [open]);

  // What the guest is looking at: the property and any dates in the URL.
  const params = new URLSearchParams(location.search);
  const context = {
    org_id: org?.id || undefined,
    check_in: params.get('check_in') || undefined,
    check_out: params.get('check_out') || undefined,
    guests: params.get('guests') || undefined,
  };
  const query = context.check_in && context.check_out ? `?check_in=${context.check_in}&check_out=${context.check_out}${context.guests ? `&guests=${context.guests}` : ''}` : '';

  const send = async (text) => {
    const message = (text ?? input).trim();
    if (!message || busy) return;
    const history = messages.filter(m => m !== WELCOME).map(m => ({ role: m.role, content: m.content })).slice(-8);
    setMessages(m => [...m, { role: 'user', content: message }]);
    setInput('');
    setBusy(true);
    try {
      const { data } = await bookingAPI.askAssistant({ message, context, history });
      setMessages(m => [...m, {
        role: 'assistant', content: data.reply, stays: data.stays, bookings: data.bookings,
        actions: data.actions, suggestions: data.suggestions, source: data.source,
      }]);
    } catch (err) {
      const limited = err.response?.status === 429;
      setMessages(m => [...m, {
        role: 'assistant',
        content: limited ? 'You’re sending messages quickly - please wait a moment and try again.' : 'Sorry, I couldn’t reach the server. Please try again.',
        suggestions: [],
      }]);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => setMessages([WELCOME]);
  const last = messages[messages.length - 1];

  return (
    <>
      {open && (
        <section
          role="dialog"
          aria-label="Chat with the CoreX Stays assistant"
          className="fixed z-50 bottom-24 right-3 left-3 sm:left-auto sm:right-6 sm:w-[400px] h-[min(600px,calc(100vh-8rem))] flex flex-col rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl shadow-black/25 origin-bottom-right animate-pop-in motion-reduce:animate-none"
        >
          <header className="relative flex items-center gap-3 px-4 py-3.5 bg-slate-950 text-white">
            <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-green-500/30 via-teal-500/10 to-blue-500/30" />
            <span className="relative w-10 h-10 rounded-2xl bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center shadow-lg"><Sparkles className="w-5 h-5" /></span>
            <div className="relative flex-1 min-w-0">
              <p className="font-bold leading-tight">Stay assistant</p>
              <p className="flex items-center gap-1.5 text-xs text-white/70"><span className="w-1.5 h-1.5 rounded-full bg-green-400" />Online · instant answers</p>
            </div>
            <button type="button" onClick={reset} title="Start over" aria-label="Start a new chat" className="relative p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10"><RotateCcw className="w-4 h-4" /></button>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close chat" className="relative p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10"><X className="w-5 h-5" /></button>
          </header>

          <div ref={listRef} className="flex-1 overflow-y-auto scroll-smooth px-4 py-4 space-y-4 bg-slate-50 dark:bg-slate-900" aria-live="polite">
            {messages.map((m, i) => (m.role === 'user' ? (
              <div key={i} className="flex justify-end">
                <p className="max-w-[80%] px-3.5 py-2.5 rounded-2xl rounded-br-md bg-gradient-to-r from-green-500 to-blue-500 text-white text-sm whitespace-pre-line">{m.content}</p>
              </div>
            ) : (
              <div key={i} className="space-y-2">
                <div className="flex items-end gap-2">
                  <span className="w-7 h-7 rounded-xl bg-gradient-to-br from-green-400 to-blue-500 text-white flex items-center justify-center flex-shrink-0"><Sparkles className="w-3.5 h-3.5" /></span>
                  <div className="max-w-[85%] px-3.5 py-2.5 rounded-2xl rounded-bl-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-slate-100 whitespace-pre-line shadow-sm">
                    {m.content}
                    {m.source === 'ai' && <span className="mt-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">AI answer · check details on the property page</span>}
                  </div>
                </div>
                {m.stays?.length > 0 && (
                  <div className="pl-9 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
                    {m.stays.map(s => <StayMini key={s.id} s={s} query={query} />)}
                  </div>
                )}
                {m.bookings?.length > 0 && (
                  <div className="pl-9 space-y-2">{m.bookings.map(b => <BookingMini key={b.id} b={b} />)}</div>
                )}
                {m.actions?.length > 0 && (
                  <div className="pl-9 flex flex-wrap gap-2">
                    {m.actions.map(a => (
                      <Link key={a.to} to={a.to} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold hover:opacity-90">
                        {a.label}<ArrowRight className="w-3 h-3" />
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )))}
            {busy && (
              <div className="flex items-end gap-2" aria-label="Assistant is typing">
                <span className="w-7 h-7 rounded-xl bg-gradient-to-br from-green-400 to-blue-500 text-white flex items-center justify-center"><Sparkles className="w-3.5 h-3.5" /></span>
                <span className="px-4 py-3 rounded-2xl rounded-bl-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex gap-1">
                  {[0, 150, 300].map(d => <span key={d} className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
                </span>
              </div>
            )}
          </div>

          {!busy && last?.role === 'assistant' && last.suggestions?.length > 0 && (
            <div className="px-3 pt-2 flex gap-1.5 overflow-x-auto bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 [scrollbar-width:none]">
              {last.suggestions.map(sug => (
                <button key={sug} type="button" onClick={() => send(sug)}
                  className="flex-shrink-0 px-3 py-1.5 rounded-full border border-green-200 dark:border-green-500/30 bg-green-50 dark:bg-green-500/10 text-xs font-semibold text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-500/20">
                  {sug}
                </button>
              ))}
            </div>
          )}
          <form onSubmit={e => { e.preventDefault(); send(); }} className="flex items-center gap-2 p-3 bg-white dark:bg-slate-900">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={user ? `Ask anything, ${user.first_name || 'there'}…` : 'Ask about stays, dates, policies…'}
              maxLength={500}
              aria-label="Message"
              className="flex-1 h-11 px-4 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500/40 focus:border-green-500"
            />
            <button type="submit" disabled={!input.trim() || busy} aria-label="Send"
              className="w-11 h-11 rounded-full bg-gradient-to-r from-green-500 to-blue-500 text-white flex items-center justify-center shadow-md disabled:opacity-40 transition-opacity">
              <Send className="w-4 h-4" />
            </button>
          </form>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Close chat' : 'Chat with us'}
        aria-expanded={open}
        className="fixed z-50 bottom-6 right-6 group flex items-center gap-2 h-14 pl-4 pr-5 rounded-full bg-gradient-to-r from-green-500 to-blue-500 text-white font-semibold shadow-xl shadow-green-500/30 hover:shadow-2xl hover:scale-[1.03] transition-all"
      >
        {!open && <span aria-hidden="true" className="absolute inset-0 rounded-full bg-green-400/40 animate-ping [animation-duration:2.5s] motion-reduce:hidden" />}
        <span className="relative">{open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}</span>
        <span className="relative hidden sm:inline">{open ? 'Close' : 'Ask us'}</span>
      </button>
    </>
  );
};

export default GuestChat;
