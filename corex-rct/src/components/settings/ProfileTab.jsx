import React, { useRef, useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { userAPI } from '../../services/api';
import Avatar from '../common/Avatar';
import { Field, FormFooter, SaveButton, SettingsCard, apiErrorMessage, inputCls, useSaveState } from './settingsUi';

const formatRole = (role = '') => role.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');

const ProfileTab = () => {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });
  const { saving, saved, error, run } = useSaveState();
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const fileRef = useRef(null);

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = await run(async () => (await userAPI.updateProfile(form)).data, 'Failed to update profile');
    if (data) updateUser(data);
  };

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setPhotoError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await userAPI.uploadProfilePicture(user.id, fd);
      updateUser({ profile_picture: data.profile_picture });
    } catch (err) {
      setPhotoError(apiErrorMessage(err, 'Failed to upload photo'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <SettingsCard title="Photo" description={user?.role === 'CUSTOMER' ? 'Shown in the top bar of your account.' : 'Shown in the top bar and next to your actions in the activity log.'}>
        <div className="flex items-center gap-4">
          <Avatar
            src={user?.profile_picture}
            initials={`${user?.first_name?.[0] || ''}${user?.last_name?.[0] || ''}`}
            className="w-16 h-16 rounded-full text-xl"
          />
          <div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 disabled:opacity-50"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              {uploading ? 'Uploading…' : user?.profile_picture ? 'Change photo' : 'Upload photo'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
            {photoError && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{photoError}</p>}
          </div>
        </div>
      </SettingsCard>

      <SettingsCard title="Personal details">
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" htmlFor="p-first">
              <input id="p-first" className={inputCls} value={form.first_name} onChange={set('first_name')} required />
            </Field>
            <Field label="Last name" htmlFor="p-last">
              <input id="p-last" className={inputCls} value={form.last_name} onChange={set('last_name')} />
            </Field>
            <Field label="Email" htmlFor="p-email" hint="Used to sign in and for password resets.">
              <input id="p-email" type="email" className={inputCls} value={form.email} onChange={set('email')} required />
            </Field>
            <Field label="Phone" htmlFor="p-phone">
              <input id="p-phone" type="tel" className={inputCls} value={form.phone} onChange={set('phone')} placeholder="+91 98765 43210" />
            </Field>
          </div>
          <dl className="grid gap-4 sm:grid-cols-2 mt-4">
            <div>
              <dt className="text-xs font-medium text-slate-600 dark:text-slate-300">Username</dt>
              <dd className="mt-1 text-sm text-slate-900 dark:text-white">{user?.username}</dd>
            </div>
            {user?.role !== 'CUSTOMER' && <div>
              <dt className="text-xs font-medium text-slate-600 dark:text-slate-300">Role</dt>
              <dd className="mt-1 text-sm text-slate-900 dark:text-white">
                {formatRole(user?.role)}{user?.organization_name ? ` · ${user.organization_name}` : ''}
              </dd>
            </div>}
          </dl>
          <FormFooter error={error}>
            <SaveButton saving={saving} saved={saved} />
          </FormFooter>
        </form>
      </SettingsCard>
    </div>
  );
};

export default ProfileTab;
