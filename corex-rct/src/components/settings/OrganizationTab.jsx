import React, { useEffect, useRef, useState } from 'react';
import { Building2, Camera, ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { tenantAPI } from '../../services/api';
import { orgTypeLabel } from '../../constants/orgTypes';
import Avatar from '../common/Avatar';
import LocationField from '../LocationField';
import {
  ErrorCard, Field, FormFooter, LoadingCard, SaveButton, SettingsCard, apiErrorMessage, inputCls, useSaveState,
} from './settingsUi';

const toForm = (org) => ({
  name: org.name || '',
  contact_email: org.contact_email || '',
  contact_phone: org.contact_phone || '',
  address: org.address || '',
  latitude: org.latitude ?? '',
  longitude: org.longitude ?? '',
});

const OrganizationTab = () => {
  const { user, updateUser } = useAuth();
  const [org, setOrg] = useState(null);
  const [form, setForm] = useState(null);
  const [loadError, setLoadError] = useState('');
  const { saving, saved, error, run } = useSaveState();
  const [uploading, setUploading] = useState(false);
  const [logoError, setLogoError] = useState('');
  const fileRef = useRef(null);
  const coverRef = useRef(null);
  const [coverBusy, setCoverBusy] = useState(false);
  const [coverError, setCoverError] = useState('');
  const isRoomBooking = org?.org_type === 'ROOM_BOOKING';

  useEffect(() => {
    tenantAPI.getMyOrganization()
      .then(({ data }) => { setOrg(data); setForm(toForm(data)); })
      .catch(err => setLoadError(apiErrorMessage(err, 'Could not load your organization')));
  }, []);

  if (loadError) return <ErrorCard message={loadError} />;
  if (!form) return <LoadingCard />;

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      latitude: form.latitude === '' ? null : form.latitude,
      longitude: form.longitude === '' ? null : form.longitude,
    };
    const data = await run(async () => (await tenantAPI.updateMyOrganization(payload)).data, 'Failed to save organization');
    if (data) {
      setOrg(data);
      setForm(toForm(data));
      updateUser({ organization_name: data.name });
    }
  };

  const handleLogo = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setLogoError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await tenantAPI.uploadMyOrganizationLogo(fd);
      setOrg(data);
      updateUser({ organization_logo: data.logo });
    } catch (err) {
      setLogoError(apiErrorMessage(err, 'Failed to upload logo'));
    } finally {
      setUploading(false);
    }
  };

  const handleCover = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setCoverError('Cover photo must be 5 MB or smaller.'); return; }
    setCoverBusy(true);
    setCoverError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await tenantAPI.uploadMyOrganizationCover(fd);
      setOrg(data);
    } catch (err) {
      setCoverError(apiErrorMessage(err, 'Failed to upload cover photo'));
    } finally {
      setCoverBusy(false);
    }
  };

  const removeCover = async () => {
    if (!window.confirm('Remove the cover photo? Your booking site will use a room photo instead.')) return;
    setCoverBusy(true);
    setCoverError('');
    try {
      const { data } = await tenantAPI.removeMyOrganizationCover();
      setOrg(data);
    } catch (err) {
      setCoverError(apiErrorMessage(err, 'Failed to remove cover photo'));
    } finally {
      setCoverBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {isRoomBooking && (
        <SettingsCard
          title="Cover photo"
          description="The big banner on your booking site and the photo on your card in the property list. Use a wide, bright photo of your building or best room."
        >
          <div className="relative h-48 sm:h-64 rounded-xl overflow-hidden bg-gradient-to-br from-green-500 to-emerald-600">
            {org.cover_image ? (
              <img src={org.cover_image} alt="Cover" className="w-full h-full object-cover" />
            ) : (
              <button type="button" onClick={() => coverRef.current?.click()} disabled={coverBusy}
                className="w-full h-full flex flex-col items-center justify-center gap-2 text-white/90 hover:text-white">
                <ImagePlus className="w-10 h-10" />
                <span className="text-sm font-medium">Add a cover photo</span>
              </button>
            )}
            <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-slate-950/70 to-transparent">
              <p className="text-xl font-bold text-white drop-shadow">{org.name}</p>
              {org.address && <p className="text-sm text-white/85">{org.address}</p>}
            </div>
            {coverBusy && (
              <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center"><Loader2 className="w-8 h-8 text-white animate-spin" /></div>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => coverRef.current?.click()} disabled={coverBusy}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 disabled:opacity-50">
              <ImagePlus className="w-4 h-4" />{org.cover_image ? 'Change cover' : 'Upload cover'}
            </button>
            {org.cover_image && (
              <button type="button" onClick={removeCover} disabled={coverBusy}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10 disabled:opacity-50">
                <Trash2 className="w-4 h-4" />Remove
              </button>
            )}
            <span className="text-xs text-slate-400 dark:text-slate-500">Landscape, about 1600 × 600 px · JPG or PNG · up to 5 MB</span>
            <input ref={coverRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleCover} />
          </div>
          {coverError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{coverError}</p>}
        </SettingsCard>
      )}

      <SettingsCard title="Branding" description={isRoomBooking ? 'Shown in the top bar and on your customer booking site.' : 'Shown in the top bar for everyone in your organization.'}>
        <div className="flex flex-wrap items-center gap-4">
          <Avatar src={org.logo} icon={Building2} className="w-16 h-16 rounded-xl" bg="bg-slate-100 dark:bg-slate-700" textClass="text-slate-400" />
          <div className="min-w-0">
            <p className="font-medium text-slate-900 dark:text-white truncate">{org.name}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {org.tenant_type === 'MSP' ? 'Multi-Service Provider' : 'Single Tenant Portal'}
              {org.org_type ? ` · ${orgTypeLabel(org.org_type)}` : ''}
            </p>
          </div>
          <div className="sm:ml-auto">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 disabled:opacity-50"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              {uploading ? 'Uploading…' : org.logo ? 'Change logo' : 'Upload logo'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogo} />
            {logoError && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{logoError}</p>}
          </div>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Details & contact"
        description={isRoomBooking ? 'Customers see these contact details on your booking site.' : undefined}
      >
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Organization name" htmlFor="o-name" className="sm:col-span-2">
              <input id="o-name" className={inputCls} value={form.name} onChange={set('name')} required maxLength={100} />
            </Field>
            <Field label="Contact email" htmlFor="o-email">
              <input id="o-email" type="email" className={inputCls} value={form.contact_email} onChange={set('contact_email')} placeholder="hello@yourbusiness.com" />
            </Field>
            <Field label="Contact phone" htmlFor="o-phone">
              <input id="o-phone" type="tel" className={inputCls} value={form.contact_phone} onChange={set('contact_phone')} placeholder="+91 98765 43210" maxLength={30} />
            </Field>
            <Field label="Address" htmlFor="o-address" className="sm:col-span-2">
              <textarea id="o-address" rows={2} className={inputCls} value={form.address} onChange={set('address')} placeholder="Street, city, PIN" />
            </Field>
            <div className="sm:col-span-2">
              <LocationField
                latitude={form.latitude}
                longitude={form.longitude}
                onResolved={(lat, lng) => setForm(f => ({ ...f, latitude: lat, longitude: lng }))}
                onClear={() => setForm(f => ({ ...f, latitude: '', longitude: '' }))}
              />
            </div>
          </div>
          <FormFooter error={error}>
            <SaveButton saving={saving} saved={saved} />
          </FormFooter>
        </form>
      </SettingsCard>

      <p className="text-xs text-slate-400 dark:text-slate-500">
        Organization ID {org.id} · created {new Date(org.created_on).toLocaleDateString()}
        {user?.role === 'STP_ADMIN' && ' · Business type and status are managed by your service provider.'}
      </p>
    </div>
  );
};

export default OrganizationTab;
