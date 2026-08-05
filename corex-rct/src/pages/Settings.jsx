import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import { tenantAPI, userAPI, salaryAPI, authAPI } from '../services/api';
import { Settings as SettingsIcon, DollarSign, Save, Building2, Shield, Loader2, Check } from 'lucide-react';

const TABS = [
  { id: 'general', label: 'General', icon: SettingsIcon },
  { id: 'salary', label: 'Salary & Pay', icon: DollarSign },
  { id: 'organization', label: 'Organization', icon: Building2 },
  { id: 'security', label: 'Security', icon: Shield },
];

const Settings = () => {
  const { user } = useAuth();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('general');

  const [orgs, setOrgs] = useState([]);
  const [users, setUsers] = useState([]);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [salarySettings, setSalarySettings] = useState({
    daily_rate: '',
    working_days_per_month: 26,
    overtime_rate: '',
    leave_deduction: true,
  });

  const [generalSettings, setGeneralSettings] = useState({
    org_name: '',
    timezone: 'Asia/Kolkata',
    date_format: 'DD/MM/YYYY',
    currency: 'INR',
  });

  const [passwordForm, setPasswordForm] = useState({
    old_password: '',
    new_password: '',
    confirm_password: '',
  });

  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');

  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [orgsRes, usersRes, salaryRes] = await Promise.all([
          tenantAPI.getTenants(),
          userAPI.getUsers(),
          salaryAPI.getSalarySettings(),
        ]);

        setOrgs(orgsRes.data || []);
        setUsers(usersRes.data || []);

        if (salaryRes.data) {
          setSalarySettings(prev => ({ ...prev, ...salaryRes.data }));
        }

        // Optional: derive org name from first tenant
        if (orgsRes.data?.length > 0) {
          setGeneralSettings(prev => ({
            ...prev,
            org_name: orgsRes.data[0].name || '',
          }));
        }

      } catch (err) {
        console.error('Error loading settings:', err);
      }
    };

    fetchData();
  }, []);

  // ─────────────────────────────────────────────────────────────
  const showSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // ── SAVE SALARY ───────────────────────────────────────────────
  const handleSaveSalary = async () => {
    setSaving(true);
    try {
      await salaryAPI.updateSalarySettings(salarySettings);
      showSaved();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save salary settings');
    } finally {
      setSaving(false);
    }
  };

  // ── SAVE GENERAL (example using tenant update) ─────────────────
  const handleSaveGeneral = async () => {
    if (!orgs.length) return;

    setSaving(true);
    try {
      await tenantAPI.updateTenant(orgs[0].id, {
        name: generalSettings.org_name,
      });
      showSaved();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save general settings');
    } finally {
      setSaving(false);
    }
  };

  // ── CHANGE PASSWORD ───────────────────────────────────────────
  const handleChangePassword = async (e) => {
    e.preventDefault();

    setPwError('');
    setPwSuccess('');

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setPwError('Passwords do not match');
      return;
    }

    try {
      await authAPI.changePassword(
        passwordForm.old_password,
        passwordForm.new_password,
        passwordForm.confirm_password
      );

      setPwSuccess('Password changed successfully');
      setPasswordForm({
        old_password: '',
        new_password: '',
        confirm_password: '',
      });

    } catch (err) {
      setPwError(err.response?.data?.error || 'Failed to change password');
    }
  };

  // ── SAVE BUTTON ───────────────────────────────────────────────
  const SaveBtn = ({ onClick }) => (
    <button
      onClick={onClick}
      disabled={saving}
      className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded-lg disabled:opacity-50"
    >
      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> :
        saved ? <Check className="w-4 h-4" /> :
          <Save className="w-4 h-4" />}
      {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
    </button>
  );

  // ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-900">
      <Navbar />

      <div className="flex">
        <Sidebar
          userRole={user.role}
          tenants={orgs}
          users={users}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(p => !p)}
        />

        <div className="flex-1 p-6">
          <h1 className="text-2xl text-white font-bold mb-6">Settings</h1>

          {/* Tabs */}
          <div className="flex gap-3 mb-6">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg text-sm ${
                  activeTab === tab.id
                    ? 'bg-green-500 text-white'
                    : 'bg-slate-700 text-slate-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── GENERAL ───────────────── */}
          {activeTab === 'general' && (
            <div className="bg-slate-800 p-6 rounded-xl">
              <div className="flex justify-between mb-4">
                <h2 className="text-white font-semibold">General Settings</h2>
                <SaveBtn onClick={handleSaveGeneral} />
              </div>

              <input
                value={generalSettings.org_name}
                onChange={e =>
                  setGeneralSettings(s => ({ ...s, org_name: e.target.value }))
                }
                className="w-full p-2 rounded bg-slate-700 text-white"
                placeholder="Organization Name"
              />
            </div>
          )}

          {/* ── SALARY ───────────────── */}
          {activeTab === 'salary' && (
            <div className="bg-slate-800 p-6 rounded-xl">
              <div className="flex justify-between mb-4">
                <h2 className="text-white font-semibold">Salary Settings</h2>
                <SaveBtn onClick={handleSaveSalary} />
              </div>

              <input
                type="number"
                value={salarySettings.daily_rate}
                onChange={e =>
                  setSalarySettings(s => ({ ...s, daily_rate: e.target.value }))
                }
                className="w-full p-2 rounded bg-slate-700 text-white"
                placeholder="Daily Rate"
              />
            </div>
          )}

          {/* ── SECURITY ───────────────── */}
          {activeTab === 'security' && (
            <form onSubmit={handleChangePassword} className="bg-slate-800 p-6 rounded-xl space-y-3">
              {pwError && <p className="text-red-400">{pwError}</p>}
              {pwSuccess && <p className="text-green-400">{pwSuccess}</p>}

              <input
                type="password"
                placeholder="Old Password"
                value={passwordForm.old_password}
                onChange={e => setPasswordForm(p => ({ ...p, old_password: e.target.value }))}
                className="w-full p-2 rounded bg-slate-700 text-white"
              />

              <input
                type="password"
                placeholder="New Password"
                value={passwordForm.new_password}
                onChange={e => setPasswordForm(p => ({ ...p, new_password: e.target.value }))}
                className="w-full p-2 rounded bg-slate-700 text-white"
              />

              <button className="bg-green-500 px-4 py-2 rounded text-white">
                Change Password
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;