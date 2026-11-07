import React, { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Mail, Send, Server, XCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { tenantAPI } from '../../services/api';
import {
  ErrorCard, Field, FormFooter, LoadingCard, SaveButton, SettingsCard, Toggle, apiErrorMessage, inputCls, useSaveState,
} from './settingsUi';

const EVENTS = ['Booking request received', 'Booking confirmed (confirmation PDF attached)', 'Booking cancelled', 'After check-out: thank you + rate your stay'];

/** Settings → Email: whether and how this organization's emails to guests are sent. */
const EmailTab = () => {
  const { user } = useAuth();
  const [form, setForm] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState(null); // {ok, text}
  const { saving, saved, error, run } = useSaveState();

  const fromServer = (data) => ({ ...data, smtp_password: '' });
  useEffect(() => {
    tenantAPI.getMyEmailSettings()
      .then(({ data }) => setForm(fromServer(data)))
      .catch(err => setLoadError(apiErrorMessage(err, 'Could not load email settings')));
  }, []);

  if (loadError) return <ErrorCard message={loadError} />;
  if (!form) return <LoadingCard />;

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const orgName = user?.organization_name || 'Your property';
  const custom = form.mode === 'CUSTOM';

  const save = async (e) => {
    e?.preventDefault();
    const payload = { ...form };
    ['has_password', 'platform_from', 'effective_reply_to', 'last_test_at', 'last_test_ok', 'last_test_error'].forEach(k => delete payload[k]);
    if (!payload.smtp_password) delete payload.smtp_password; // keep the saved one
    payload.smtp_port = Number(payload.smtp_port) || 587;
    const data = await run(async () => (await tenantAPI.updateMyEmailSettings(payload)).data, 'Failed to save email settings');
    if (data) { setForm(fromServer(data)); setTestMsg(null); }
    return data;
  };

  const sendTest = async () => {
    setTesting(true);
    setTestMsg(null);
    try {
      const { data } = await tenantAPI.sendTestEmail();
      setForm(f => ({ ...f, last_test_ok: data.last_test_ok, last_test_at: data.last_test_at, last_test_error: '' }));
      setTestMsg({ ok: true, text: data.message });
    } catch (err) {
      setTestMsg({ ok: false, text: apiErrorMessage(err, 'Sending failed.') });
    } finally {
      setTesting(false);
    }
  };

  const ModeCard = ({ id, icon: Icon, title, children }) => (
    <button type="button" role="radio" aria-checked={form.mode === id} onClick={() => setForm(f => ({ ...f, mode: id }))}
      className={`text-left rounded-xl border-2 p-4 transition-colors ${form.mode === id ? 'border-green-500 bg-green-500/5' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}>
      <span className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white"><Icon className="w-4 h-4 text-green-600" />{title}</span>
      <span className="mt-1 block text-sm text-slate-500 dark:text-slate-400">{children}</span>
    </button>
  );

  return (
    <form onSubmit={save} className="space-y-6">
      <SettingsCard title="Guest emails" description="Automatic emails to guests about their bookings, sent in your name.">
        <Toggle checked={form.send_booking_emails} onChange={v => setForm(f => ({ ...f, send_booking_emails: v }))}
          label="Email guests about their bookings" description={form.send_booking_emails ? 'On - guests get these emails:' : 'Off - guests get no booking emails.'} />
        {form.send_booking_emails && (
          <ul className="mt-3 grid gap-1.5 sm:grid-cols-2 text-sm text-slate-600 dark:text-slate-300">
            {EVENTS.map(e => <li key={e} className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />{e}</li>)}
          </ul>
        )}
      </SettingsCard>

      <SettingsCard title="How emails are sent">
        <div role="radiogroup" className="grid gap-3 md:grid-cols-2">
          <ModeCard id="PLATFORM" icon={Mail} title="Send through CoreX (recommended)">
            Nothing to set up. Guests see your name as the sender, and their replies come to your email.
          </ModeCard>
          <ModeCard id="CUSTOM" icon={Server} title="Use our own email account">
            Emails come from your own address (e.g. bookings@yourhotel.com). Needs your mail server details.
          </ModeCard>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Sender name" htmlFor="em-name" hint="What guests see in their inbox.">
            <input id="em-name" className={inputCls} value={form.from_name} onChange={set('from_name')} placeholder={orgName} maxLength={100} />
          </Field>
          <Field label="Replies go to" htmlFor="em-reply" hint={form.reply_to ? undefined : `Leave blank to use your contact email${form.effective_reply_to ? ` (${form.effective_reply_to})` : ' - set one in Organization'}.`}>
            <input id="em-reply" type="email" className={inputCls} value={form.reply_to} onChange={set('reply_to')} placeholder={form.effective_reply_to || 'frontdesk@yourhotel.com'} />
          </Field>
        </div>

        {!custom && (
          <p className="mt-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-700/40 text-sm text-slate-600 dark:text-slate-300">
            Guests will see: <b className="text-slate-900 dark:text-white">{form.from_name || orgName}</b> &lt;{form.platform_from}&gt;
            {form.effective_reply_to || form.reply_to ? <> · replies go to <b className="text-slate-900 dark:text-white">{form.reply_to || form.effective_reply_to}</b></> : ' · add a reply-to address so guests can answer you'}
          </p>
        )}

        {custom && (
          <div className="mt-5 pt-5 border-t border-slate-100 dark:border-slate-700 grid gap-4 sm:grid-cols-2">
            <Field label="Mail server (SMTP host)" htmlFor="em-host" hint="Gmail: smtp.gmail.com · Outlook: smtp.office365.com">
              <input id="em-host" className={inputCls} value={form.smtp_host} onChange={set('smtp_host')} placeholder="smtp.gmail.com" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Port" htmlFor="em-port">
                <input id="em-port" type="number" min="1" max="65535" className={inputCls} value={form.smtp_port} onChange={set('smtp_port')} />
              </Field>
              <Field label="Security" htmlFor="em-sec">
                <select id="em-sec" className={inputCls} value={form.smtp_security}
                  onChange={e => setForm(f => ({ ...f, smtp_security: e.target.value, smtp_port: e.target.value === 'SSL' ? 465 : e.target.value === 'TLS' ? 587 : f.smtp_port }))}>
                  <option value="TLS">STARTTLS (587)</option>
                  <option value="SSL">SSL/TLS (465)</option>
                  <option value="NONE">None</option>
                </select>
              </Field>
            </div>
            <Field label="Username" htmlFor="em-user" hint="Usually the full email address.">
              <input id="em-user" className={inputCls} value={form.smtp_username} onChange={set('smtp_username')} placeholder="bookings@yourhotel.com" autoComplete="off" />
            </Field>
            <Field label="Password" htmlFor="em-pw" hint={form.has_password ? 'Saved (encrypted). Leave blank to keep it.' : 'For Gmail, use a 16-letter App Password, not your normal password.'}>
              <input id="em-pw" type="password" className={inputCls} value={form.smtp_password} onChange={set('smtp_password')}
                placeholder={form.has_password ? '••••••••••••' : ''} autoComplete="new-password" />
            </Field>
            <Field label="Send from address" htmlFor="em-from" hint="Leave blank to use the username." className="sm:col-span-2">
              <input id="em-from" type="email" className={inputCls} value={form.from_email} onChange={set('from_email')} placeholder={form.smtp_username || 'bookings@yourhotel.com'} />
            </Field>
            <p className="sm:col-span-2 text-xs text-slate-500 dark:text-slate-400">
              If your server ever fails, guest emails are still delivered through CoreX so nobody misses a confirmation.
            </p>
          </div>
        )}

        <FormFooter error={error}>
          <button type="button" onClick={async () => { if (await save()) sendTest(); }} disabled={testing || saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-white disabled:opacity-50">
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Save & send test to {user?.email}
          </button>
          <SaveButton saving={saving} saved={saved} />
        </FormFooter>
        {(testMsg || form.last_test_at) && (
          <p className={`mt-3 flex items-start gap-1.5 text-sm ${(testMsg ? testMsg.ok : form.last_test_ok) ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {(testMsg ? testMsg.ok : form.last_test_ok) ? <CheckCircle2 className="w-4 h-4 mt-0.5" /> : <XCircle className="w-4 h-4 mt-0.5" />}
            {testMsg ? testMsg.text : `Last test ${form.last_test_ok ? 'succeeded' : 'failed'} on ${new Date(form.last_test_at).toLocaleString()}${form.last_test_error ? ` - ${form.last_test_error}` : ''}`}
          </p>
        )}
      </SettingsCard>
    </form>
  );
};

export default EmailTab;
