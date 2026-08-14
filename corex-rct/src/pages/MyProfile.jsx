import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import Avatar from '../components/common/Avatar';
import { useAuth } from '../context/AuthContext';
import { userAPI, authAPI } from '../services/api';
import { ArrowLeft, Camera, Save, Loader2, Check, Shield, Building2, UserCircle } from 'lucide-react';

const inputCls = "w-full px-3 py-2.5 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500";

/**
 * Personal "who am I" page reached from the Navbar's profile menu — same
 * app shell (Navbar + Sidebar) as every other page, just with the body
 * filled by a focused profile widget instead of the admin Settings page
 * (Salary/Organization/Security tabs — a different, org-management
 * surface this is intentionally not reusing).
 */
const MyProfile = () => {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const avatarInputRef = useRef(null);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [form, setForm] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    email: user?.email || '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const [pwForm, setPwForm] = useState({ old_password: '', new_password: '', confirm_password: '' });
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [changingPw, setChangingPw] = useState(false);

  const isMSP = user?.role === 'MSP_ADMIN' || user?.role === 'MSP_USER';
  const basePath = isMSP ? '/msp' : '/stp';

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await userAPI.uploadProfilePicture(user.id, fd);
      updateUser({ profile_picture: data.profile_picture });
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to upload photo');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setError(''); setSaving(true);
    try {
      const { data } = await userAPI.updateProfile(form);
      updateUser(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.email?.[0] || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwError(''); setPwSuccess('');
    if (pwForm.new_password !== pwForm.confirm_password) {
      setPwError('Passwords do not match');
      return;
    }
    setChangingPw(true);
    try {
      await authAPI.changePassword(pwForm.old_password, pwForm.new_password, pwForm.confirm_password);
      setPwSuccess('Password changed successfully');
      setPwForm({ old_password: '', new_password: '', confirm_password: '' });
    } catch (err) {
      setPwError(err.response?.data?.error || 'Failed to change password');
    } finally {
      setChangingPw(false);
    }
  };

  return (
    <div className="h-screen overflow-hidden bg-slate-50 dark:bg-slate-900 flex flex-col">
      <Navbar />
      <div className="flex flex-1 min-h-0">
        <Sidebar userRole={user.role} collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(p => !p)} />

        <div className="flex-1 p-6 overflow-y-auto min-h-0">
          <div className="max-w-2xl mx-auto">
            {/* Breadcrumb — same pattern as OrganizationDetail/UserDetail */}
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-5">
              <button onClick={() => navigate(basePath)} className="hover:text-slate-900 dark:hover:text-white transition-colors flex items-center gap-1">
                <ArrowLeft className="w-4 h-4" /> Dashboard
              </button>
            </div>

            <div className="mb-6">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <UserCircle className="w-6 h-6 text-green-500" /> My Profile
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">Manage your personal account details and password</p>
            </div>

            <div className="space-y-6">
              {/* Identity card */}
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Avatar
                      src={user?.profile_picture}
                      initials={`${user?.first_name?.[0] || ''}${user?.last_name?.[0] || ''}`}
                      className="w-16 h-16 rounded-full text-xl"
                    />
                    <button
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={uploadingAvatar}
                      title="Change photo"
                      className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center transition-all disabled:opacity-50"
                    >
                      {uploadingAvatar ? <Loader2 className="w-3 h-3 text-white animate-spin" /> : <Camera className="w-3 h-3 text-white" />}
                    </button>
                    <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-slate-900 dark:text-white font-semibold text-lg truncate">{user?.first_name} {user?.last_name}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{user?.email}</p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-600 dark:text-green-400">
                        <Shield className="w-3 h-3" /> {user?.role?.replace(/_/g, ' ')}
                      </span>
                      {user?.organization_name && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                          <Building2 className="w-3 h-3" /> {user.organization_name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Editable details */}
              <form onSubmit={handleSaveProfile} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-slate-900 dark:text-white font-semibold">Personal Details</h2>
                  <button
                    type="submit" disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded-lg disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                    {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
                  </button>
                </div>
                {error && <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">First Name</label>
                    <input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Last Name</label>
                    <input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} className={inputCls} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Email</label>
                    <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inputCls} />
                  </div>
                </div>
              </form>

              {/* Change password */}
              <form onSubmit={handleChangePassword} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 space-y-3">
                <h2 className="text-slate-900 dark:text-white font-semibold mb-1">Change Password</h2>
                {pwError && <p className="text-sm text-red-600 dark:text-red-400">{pwError}</p>}
                {pwSuccess && <p className="text-sm text-green-600 dark:text-green-400">{pwSuccess}</p>}
                <input type="password" placeholder="Current Password" value={pwForm.old_password}
                  onChange={e => setPwForm(p => ({ ...p, old_password: e.target.value }))} className={inputCls} />
                <input type="password" placeholder="New Password" value={pwForm.new_password}
                  onChange={e => setPwForm(p => ({ ...p, new_password: e.target.value }))} className={inputCls} />
                <input type="password" placeholder="Confirm New Password" value={pwForm.confirm_password}
                  onChange={e => setPwForm(p => ({ ...p, confirm_password: e.target.value }))} className={inputCls} />
                <button
                  type="submit" disabled={changingPw}
                  className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 dark:bg-slate-600 dark:hover:bg-slate-500 text-white text-sm font-semibold rounded-lg disabled:opacity-50"
                >
                  {changingPw && <Loader2 className="w-4 h-4 animate-spin" />}
                  Change Password
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyProfile;
