import React, { useEffect, useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Check, Copy, Download, ExternalLink } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { bookingAPI } from '../../services/api';
import {
  ErrorCard, Field, FormFooter, LoadingCard, SaveButton, SettingsCard, Toggle, apiErrorMessage, inputCls, useSaveState,
} from './settingsUi';

// API sends "14:00:00"; <input type="time"> wants "14:00".
const hhmm = (t) => (t || '').slice(0, 5);

const BookingSiteTab = () => {
  const { user } = useAuth();
  const canEdit = (user?.permissions || []).includes('settings.manage');
  const link = `${window.location.origin}/book/${user?.organization_id}`;

  const [form, setForm] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [copied, setCopied] = useState(false);
  const { saving, saved, error, run } = useSaveState();
  const qrRef = useRef(null);

  useEffect(() => {
    bookingAPI.getBookingSettings()
      .then(({ data }) => setForm({ ...data, check_in_time: hhmm(data.check_in_time), check_out_time: hhmm(data.check_out_time) }))
      .catch(err => setLoadError(apiErrorMessage(err, 'Could not load booking settings')));
  }, []);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt('Copy your booking link:', link);
    }
  };

  const downloadQr = () => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `${(user?.organization_name || 'booking').replace(/\s+/g, '-').toLowerCase()}-booking-qr.png`;
    a.click();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = await run(async () => (await bookingAPI.updateBookingSettings({
      accepting_bookings: form.accepting_bookings,
      auto_confirm: form.auto_confirm,
      free_cancellation_hours: Number(form.free_cancellation_hours) || 0,
      check_in_time: form.check_in_time,
      check_out_time: form.check_out_time,
      cancellation_policy: form.cancellation_policy,
    })).data, 'Failed to save booking settings');
    if (data) setForm({ ...data, check_in_time: hhmm(data.check_in_time), check_out_time: hhmm(data.check_out_time) });
  };

  return (
    <div className="space-y-6">
      <SettingsCard title="Your booking link" description="Share this link or QR code so customers can sign up and book rooms with you.">
        <div className="flex flex-col sm:flex-row gap-5">
          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex items-stretch rounded-lg border border-slate-300 dark:border-slate-600 overflow-hidden">
              <input
                readOnly
                value={link}
                aria-label="Booking link"
                onFocus={e => e.target.select()}
                className="flex-1 min-w-0 px-3 py-2.5 bg-slate-50 dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none"
              />
              <button
                type="button"
                onClick={copyLink}
                className="inline-flex items-center gap-1.5 px-3 text-sm font-medium border-l border-slate-300 dark:border-slate-600 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
              >
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href={link}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200"
              >
                <ExternalLink className="w-4 h-4" /> Open booking site
              </a>
              <button
                type="button"
                onClick={downloadQr}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200"
              >
                <Download className="w-4 h-4" /> Download QR
              </button>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Print the QR code at your front desk or add it to your website and social pages.
            </p>
          </div>
          <div ref={qrRef} className="self-center sm:self-start p-3 bg-white rounded-xl border border-slate-200">
            <QRCodeCanvas value={link} size={132} marginSize={1} />
          </div>
        </div>
      </SettingsCard>

      {loadError && <ErrorCard message={loadError} />}
      {!loadError && !form && <LoadingCard />}
      {form && (
        <SettingsCard
          title="Booking rules"
          description={canEdit ? 'Customers see these on your booking site.' : 'Your role can view these but not change them.'}
        >
          <form onSubmit={handleSubmit} className="space-y-5">
            <Toggle
              checked={form.accepting_bookings}
              disabled={!canEdit}
              onChange={v => setForm(f => ({ ...f, accepting_bookings: v }))}
              label="Accepting new bookings"
              description={form.accepting_bookings
                ? 'Customers can book rooms right now.'
                : 'Customers can still browse rooms, but new bookings are turned away.'}
            />
            <Toggle
              checked={form.auto_confirm}
              disabled={!canEdit}
              onChange={v => setForm(f => ({ ...f, auto_confirm: v }))}
              label="Confirm bookings automatically"
              description={form.auto_confirm
                ? 'New bookings are confirmed instantly — no approval needed. With online payments on, guests pay while booking.'
                : 'Each new booking waits for you to confirm it in Bookings. Once confirmed, the guest can pay online or at the property.'}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Check-in from" htmlFor="b-in">
                <input id="b-in" type="time" className={inputCls} disabled={!canEdit} required
                  value={form.check_in_time} onChange={e => setForm(f => ({ ...f, check_in_time: e.target.value }))} />
              </Field>
              <Field label="Check-out by" htmlFor="b-out" hint="On the day of departure.">
                <input id="b-out" type="time" className={inputCls} disabled={!canEdit} required
                  value={form.check_out_time} onChange={e => setForm(f => ({ ...f, check_out_time: e.target.value }))} />
              </Field>
            </div>
            <Field
              label="Free cancellation until"
              htmlFor="b-cancel-hours"
              hint={`${Number(form.free_cancellation_hours) ? `Guests can cancel online until ${form.free_cancellation_hours} hours before check-in.` : 'Guests can cancel online right up to check-in time (0 hours).'} After that they must contact you. Online payments are refunded automatically when a guest cancels in time.`}
            >
              <div className="flex items-center gap-2 max-w-xs">
                <input id="b-cancel-hours" type="number" min="0" max="720" className={inputCls} disabled={!canEdit}
                  value={form.free_cancellation_hours} onChange={e => setForm(f => ({ ...f, free_cancellation_hours: e.target.value }))} />
                <span className="text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">hours before check-in</span>
              </div>
            </Field>
            <Field label="Cancellation policy" htmlFor="b-policy" hint="Plain text, shown to customers before they pay.">
              <textarea id="b-policy" rows={4} className={inputCls} disabled={!canEdit}
                placeholder="e.g. Free cancellation up to 24 hours before check-in. After that, the first night is non-refundable."
                value={form.cancellation_policy} onChange={e => setForm(f => ({ ...f, cancellation_policy: e.target.value }))} />
            </Field>
            {canEdit && (
              <FormFooter error={error}>
                <SaveButton saving={saving} saved={saved} />
              </FormFooter>
            )}
          </form>
        </SettingsCard>
      )}
    </div>
  );
};

export default BookingSiteTab;
