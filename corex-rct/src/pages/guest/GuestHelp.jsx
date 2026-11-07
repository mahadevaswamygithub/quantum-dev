import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, LifeBuoy, MessageCircle, Phone } from 'lucide-react';
import GuestLayout from '../../components/guest/GuestLayout';
import { CONTAINER, EYEBROW } from '../../components/guest/site';

const FAQS = [
  ['How do I book a room?', 'Search for a place and dates, open a property, pick a room and press Reserve. You need a free guest account - one account works at every property on CoreX Stays.'],
  ['Is my booking confirmed straight away?', 'Many properties confirm instantly. Others review each request first; you’ll see “Awaiting confirmation” in My trips and get an email as soon as they reply.'],
  ['How do I pay?', 'Where the property accepts online payments you can pay securely by card, UPI or net banking - at booking or later from My trips. You can always pay at the property instead. There are no booking fees.'],
  ['How do I cancel?', 'Open My trips and press Cancel booking. Each property sets a free-cancellation window (shown on its page and in your confirmation); cancelling inside it is free and online payments are refunded.'],
  ['The free-cancellation window has passed - can I still cancel?', 'Yes, you can ask. Press Request cancellation in My trips and tell the property why. Your booking stays active until they approve or decline, and you’ll get an email with their decision. You can follow it in My requests.'],
  ['When will I get my refund?', 'Refunds go back to the card or account you paid with and usually take 5–7 working days to appear.'],
  ['Where is my confirmation?', 'It’s emailed when your booking is confirmed, and you can download it any time from My trips (Download).'],
  ['How do I change my booking?', 'Contact the property directly - their phone and email are on the property page, in your confirmation and in My trips.'],
  ['How is my data used?', 'Your details are shared only with the property you book, so they can prepare your stay. You can edit them in My profile or delete your account in Settings.'],
];

/** Help & support: FAQs plus ways to get help. */
const GuestHelp = () => {
  const [open, setOpen] = useState(0);
  const openChat = () => document.querySelector('button[aria-label="Chat with us"]')?.click();
  return (
    <GuestLayout>
      <section className="relative overflow-hidden bg-gradient-to-br from-green-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 border-b border-slate-200 dark:border-slate-800">
        <div className={`${CONTAINER} py-14 text-center`}>
          <LifeBuoy className="w-10 h-10 mx-auto text-green-600 dark:text-green-400" />
          <h1 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">Help &amp; support</h1>
          <p className="mt-2 text-slate-500 dark:text-slate-400">Answers to common questions about booking, paying and cancelling.</p>
        </div>
      </section>
      <div className={`${CONTAINER} py-10 grid gap-8 lg:grid-cols-[1fr_22rem] items-start`}>
        <div>
          <p className={EYEBROW}>FAQ</p>
          <h2 className="mt-1 mb-4 text-2xl font-bold text-slate-900 dark:text-white">Frequently asked questions</h2>
          <div className="divide-y divide-slate-200 dark:divide-slate-700 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
            {FAQS.map(([q, a], i) => (
              <div key={q}>
                <button type="button" onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i}
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left font-semibold text-slate-900 dark:text-white">
                  {q}<ChevronDown className={`w-5 h-5 flex-shrink-0 text-slate-400 transition-transform ${open === i ? 'rotate-180' : ''}`} />
                </button>
                {open === i && <p className="px-5 pb-4 -mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300 animate-pop-in motion-reduce:animate-none">{a}</p>}
              </div>
            ))}
          </div>
        </div>
        <aside className="space-y-4 lg:sticky lg:top-24">
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <MessageCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
            <p className="mt-2 font-bold text-slate-900 dark:text-white">Ask the assistant</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Instant answers about stays, availability, your bookings and policies.</p>
            <button type="button" onClick={openChat} className="mt-3 w-full h-10 rounded-xl bg-gradient-to-r from-green-500 to-blue-500 text-white text-sm font-semibold">Start a chat</button>
          </div>
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <Phone className="w-6 h-6 text-green-600 dark:text-green-400" />
            <p className="mt-2 font-bold text-slate-900 dark:text-white">Questions about a booking?</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Each property handles its own bookings. You’ll find their phone and email in My trips and on the property page.</p>
            <Link to="/book/me/trips" className="mt-3 inline-block text-sm font-semibold text-green-700 dark:text-green-400 hover:underline">Go to My trips →</Link>
          </div>
        </aside>
      </div>
    </GuestLayout>
  );
};

export default GuestHelp;
