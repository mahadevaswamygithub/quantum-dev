import React, { useState } from 'react';
import { Link2, Check, Copy } from 'lucide-react';
import Card from './common/Card';

/**
 * One shared link for the whole platform — a guest picks their property
 * from a list there (BookingHome.jsx) rather than staff having to hand
 * out an org-specific URL with a raw numeric ID baked in.
 */
const BookingLinkCard = () => {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/book`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can be unavailable (e.g. insecure context) — the
      // link is still selectable/visible in the input, so this isn't fatal.
    }
  };

  return (
    <Card className="p-4 mb-5 flex flex-wrap items-center gap-3">
      <Link2 className="w-5 h-5 text-green-500 flex-shrink-0" />
      <div className="flex-1 min-w-[240px]">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Share this link — guests pick your property from the list and book</p>
        <input
          readOnly value={link} onFocus={e => e.target.select()}
          className="w-full mt-1 px-2 py-1.5 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 text-xs font-mono"
        />
      </div>
      <button
        onClick={handleCopy}
        className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-white text-sm font-medium rounded-lg transition-colors"
      >
        {copied ? <><Check className="w-4 h-4 text-green-500" /> Copied</> : <><Copy className="w-4 h-4" /> Copy Link</>}
      </button>
    </Card>
  );
};

export default BookingLinkCard;
