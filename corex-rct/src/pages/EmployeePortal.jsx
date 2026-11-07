import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import PageSpinner from '../components/common/PageSpinner';
import { useAuth } from '../context/AuthContext';
import { userAPI, attendanceAPI, salaryAPI, leaveAPI } from '../services/api';
import {
  User, Clock, DollarSign, CalendarDays, Briefcase,
  Download, Plus, Calendar, Mail, Phone, Building2, Shield,
  Wallet, FileText
} from 'lucide-react';

const TABS = [
  { id: 'overview', label: 'Overview', icon: User },
  { id: 'attendance', label: 'Attendance', icon: Clock },
  { id: 'salary', label: 'Salary', icon: DollarSign },
  { id: 'leaves', label: 'Leaves', icon: CalendarDays },
  { id: 'documents', label: 'Documents', icon: Briefcase },
];

const Badge = ({ label, color = 'blue' }) => {
  const map = {
    blue: 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400',
    green: 'bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400',
    red: 'bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400',
    yellow: 'bg-yellow-500/10 text-yellow-600 dark:bg-yellow-500/20 dark:text-yellow-400',
    purple: 'bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400',
  };
  return <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${map[color]}`}>{label}</span>;
};

// ── Overview ──────────────────────────────────────────────────────────────────
const OverviewTab = ({ userData, attendance, salary, leaves }) => {
  const thisMonth = attendance.filter(a => a.status === 'PRESENT').length;
  const pendingLeaves = leaves.filter(l => l.status === 'PENDING').length;
  const lastSalary = salary[0];

  return (
    <div className="space-y-5">
      {/* Welcome card */}
      <div className="bg-gradient-to-r from-green-500/20 to-blue-500/20 border border-green-500/30 rounded-xl p-5">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-blue-500 flex items-center justify-center text-2xl font-bold text-white overflow-hidden">
            {userData.profile_picture
              ? <img src={userData.profile_picture} alt="" className="w-full h-full object-cover" />
              : `${userData.first_name?.[0] || ''}${userData.last_name?.[0] || ''}`}
          </div>
          <div>
            <h2 className="text-slate-900 dark:text-white font-bold text-xl">Hello, {userData.first_name}! 👋</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm">{userData.organization_name} · {userData.role}</p>
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Days Present', value: thisMonth, sub: 'This month', icon: Clock, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-500/10' },
          { label: 'Pending Leaves', value: pendingLeaves, sub: 'Awaiting approval', icon: CalendarDays, color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-500/10' },
          { label: 'Last Salary', value: lastSalary ? `₹${lastSalary.net_salary?.toLocaleString()}` : '-', sub: lastSalary?.month || 'No data', icon: DollarSign, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10' },
          { label: 'Documents', value: '-', sub: 'Uploaded', icon: Briefcase, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-500/10' },
        ].map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
              <div className={`w-8 h-8 ${s.bg} rounded-lg flex items-center justify-center mb-2`}>
                <Icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-900 dark:text-white">{s.label}</p>
              <p className="text-xs text-slate-500">{s.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Info + recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
          <h4 className="text-slate-900 dark:text-white font-semibold text-sm mb-4">My Information</h4>
          {[
            { label: 'Email', value: userData.email, icon: Mail },
            { label: 'Phone', value: userData.phone, icon: Phone },
            { label: 'Organization', value: userData.organization_name, icon: Building2 },
            { label: 'Role', value: userData.role, icon: Shield },
            { label: 'Date of Joining', value: userData.created_at ? new Date(userData.created_at).toLocaleDateString() : '-', icon: Calendar },
          ].map((r, i) => {
            const Icon = r.icon;
            return (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-slate-100 dark:border-slate-700/50 last:border-0">
                <Icon className="w-4 h-4 text-slate-500 flex-shrink-0" />
                <div>
                  <p className="text-xs text-slate-500">{r.label}</p>
                  <p className="text-sm text-slate-900 dark:text-white">{r.value || '-'}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
          <h4 className="text-slate-900 dark:text-white font-semibold text-sm mb-4">Recent Leaves</h4>
          {leaves.slice(0, 5).length === 0 ? (
            <p className="text-slate-500 dark:text-slate-400 text-sm text-center py-6">No leave records</p>
          ) : leaves.slice(0, 5).map((l, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700/50 last:border-0">
              <div>
                <p className="text-slate-900 dark:text-white text-sm">{l.leave_type} Leave</p>
                <p className="text-xs text-slate-500">{l.from_date} → {l.to_date}</p>
              </div>
              <Badge label={l.status} color={l.status === 'APPROVED' ? 'green' : l.status === 'REJECTED' ? 'red' : 'yellow'} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── Employee Attendance ───────────────────────────────────────────────────────
const MyAttendance = ({ userId }) => {
  const [records, setRecords] = useState([]);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await attendanceAPI.getUserAttendance(userId, month);
        setRecords(res.data || []);
      } catch { setRecords([]); }
      finally { setLoading(false); }
    })();
  }, [userId, month]);

  const present = records.filter(r => r.status === 'PRESENT').length;
  const absent = records.filter(r => r.status === 'ABSENT').length;
  const leave = records.filter(r => r.status === 'LEAVE').length;
  const statusColor = { PRESENT: 'green', ABSENT: 'red', LEAVE: 'yellow', HALF_DAY: 'purple' };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Present', value: present, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-500/10' },
          { label: 'Absent', value: absent, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10' },
          { label: 'On Leave', value: leave, color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-500/10' },
        ].map((s, i) => (
          <div key={i} className={`${s.bg} rounded-xl p-4 text-center`}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h4 className="font-semibold text-slate-900 dark:text-white text-sm">My Attendance</h4>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>
        {loading ? <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-sm">Loading...</div> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-700/50">
                <tr>
                  {['Date', 'Day', 'Status', 'Check In', 'Check Out', 'Hours'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {records.length === 0 ? (
                  <tr><td colSpan="6" className="px-4 py-8 text-center text-slate-500 dark:text-slate-400 text-sm">No records for this month</td></tr>
                ) : records.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="px-4 py-3 text-sm text-slate-900 dark:text-white">{r.date}</td>
                    <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">{new Date(r.date).toLocaleDateString('en', { weekday: 'short' })}</td>
                    <td className="px-4 py-3"><Badge label={r.status} color={statusColor[r.status] || 'blue'} /></td>
                    <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">{r.check_in || '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">{r.check_out || '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">{r.hours_worked ? `${r.hours_worked}h` : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Employee Salary ───────────────────────────────────────────────────────────
const MySalary = ({ userId }) => {
  const [records, setRecords] = useState([]);
  const [, setAdvances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdvance, setShowAdvance] = useState(false);
  const [form, setForm] = useState({ amount: '', note: '' });

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [sRes, aRes] = await Promise.all([salaryAPI.getUserSalary(userId), salaryAPI.getSalaryAdvances(userId)]);
        setRecords(sRes.data || []);
        setAdvances(aRes.data || []);
      } catch { }
      finally { setLoading(false); }
    })();
  }, [userId]);

  const handleDownload = async (id) => {
    try {
      const res = await salaryAPI.downloadPayslip(id);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a'); a.href = url; a.download = `payslip_${id}.pdf`; a.click();
    } catch { alert('Failed to download'); }
  };

  const handleAdvance = async () => {
    try {
      await salaryAPI.requestAdvance(userId, form);
      setShowAdvance(false);
      const aRes = await salaryAPI.getSalaryAdvances(userId);
      setAdvances(aRes.data || []);
    } catch { alert('Failed'); }
  };

  if (loading) return <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-sm">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowAdvance(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500/10 border border-yellow-500/30 text-yellow-600 dark:bg-yellow-500/20 dark:text-yellow-400 text-sm font-medium rounded-lg hover:bg-yellow-500/20 dark:hover:bg-yellow-500/30 transition-all">
          <Wallet className="w-4 h-4" /> Request Advance
        </button>
      </div>

      {showAdvance && (
        <div className="bg-white dark:bg-slate-800 border border-yellow-500/30 rounded-xl p-5">
          <h4 className="text-slate-900 dark:text-white font-semibold text-sm mb-3">Salary Advance Request</h4>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Amount (₹)</label>
              <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="5000" />
            </div>
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Reason</label>
              <input type="text" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="Reason..." />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowAdvance(false)} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white text-sm rounded-lg">Cancel</button>
            <button onClick={handleAdvance} className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg">Submit</button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700"><h4 className="font-semibold text-slate-900 dark:text-white text-sm">My Salary</h4></div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-700/50">
              <tr>{['Month', 'Days', 'Daily Rate', 'Gross', 'Net Pay', 'Status', ''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {records.length === 0 ? (
                <tr><td colSpan="7" className="px-4 py-8 text-center text-slate-500 dark:text-slate-400 text-sm">No salary records</td></tr>
              ) : records.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <td className="px-4 py-3 text-sm text-slate-900 dark:text-white font-medium">{r.month}</td>
                  <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">{r.days_present}</td>
                  <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">₹{r.daily_rate}</td>
                  <td className="px-4 py-3 text-sm text-slate-900 dark:text-white">₹{r.gross_salary?.toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm text-green-600 dark:text-green-400 font-semibold">₹{r.net_salary?.toLocaleString()}</td>
                  <td className="px-4 py-3"><Badge label={r.status} color={r.status === 'PAID' ? 'green' : 'yellow'} /></td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleDownload(r.id)} className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors">
                      <Download className="w-4 h-4 text-blue-400" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ── Employee Leaves ───────────────────────────────────────────────────────────
const MyLeaves = ({ userId }) => {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showApply, setShowApply] = useState(false);
  const [form, setForm] = useState({ leave_type: 'CASUAL', from_date: '', to_date: '', reason: '' });

  const fetchLeaves = useCallback(async () => {
    setLoading(true);
    try { const res = await leaveAPI.getUserLeaves(userId); setLeaves(res.data || []); }
    catch { setLeaves([]); }
    finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { fetchLeaves(); }, [fetchLeaves]);

  const handleApply = async () => {
    try { await leaveAPI.applyLeave(userId, form); setShowApply(false); await fetchLeaves(); }
    catch { alert('Failed'); }
  };

  if (loading) return <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-sm">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowApply(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg">
          <Plus className="w-3.5 h-3.5" /> Apply Leave
        </button>
      </div>

      {showApply && (
        <div className="bg-white dark:bg-slate-800 border border-green-500/30 rounded-xl p-5">
          <h4 className="text-slate-900 dark:text-white font-semibold text-sm mb-3">Apply for Leave</h4>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Leave Type</label>
              <select value={form.leave_type} onChange={e => setForm(f => ({ ...f, leave_type: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                <option value="CASUAL">Casual</option>
                <option value="SICK">Sick</option>
                <option value="ANNUAL">Annual</option>
                <option value="UNPAID">Unpaid</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">From</label>
              <input type="date" value={form.from_date} onChange={e => setForm(f => ({ ...f, from_date: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">To</label>
              <input type="date" value={form.to_date} onChange={e => setForm(f => ({ ...f, to_date: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Reason</label>
              <input type="text" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowApply(false)} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white text-sm rounded-lg">Cancel</button>
            <button onClick={handleApply} className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg">Submit</button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700"><h4 className="font-semibold text-slate-900 dark:text-white text-sm">My Leave History</h4></div>
        <table className="w-full">
          <thead className="bg-slate-50 dark:bg-slate-700/50">
            <tr>{['Type', 'From', 'To', 'Days', 'Reason', 'Status'].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">{h}</th>
            ))}</tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {leaves.length === 0 ? (
              <tr><td colSpan="6" className="px-4 py-8 text-center text-slate-500 dark:text-slate-400 text-sm">No leave records</td></tr>
            ) : leaves.map((l, i) => (
              <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                <td className="px-4 py-3"><Badge label={l.leave_type} color="blue" /></td>
                <td className="px-4 py-3 text-sm text-slate-900 dark:text-white">{l.from_date}</td>
                <td className="px-4 py-3 text-sm text-slate-900 dark:text-white">{l.to_date}</td>
                <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">{l.days}</td>
                <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 max-w-[120px] truncate">{l.reason}</td>
                <td className="px-4 py-3"><Badge label={l.status} color={l.status === 'APPROVED' ? 'green' : l.status === 'REJECTED' ? 'red' : 'yellow'} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ── Employee Documents ────────────────────────────────────────────────────────
const MyDocuments = ({ userId }) => {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try { const res = await userAPI.getUserDocuments(userId); setDocs(res.data || []); }
      catch { setDocs([]); }
      finally { setLoading(false); }
    })();
  }, [userId]);

  const docTypes = [
    { type: 'AADHAAR', label: 'Aadhaar Card' },
    { type: 'PAN', label: 'PAN Card' },
    { type: 'PASSPORT', label: 'Passport' },
    { type: 'OFFER_LETTER', label: 'Offer Letter' },
    { type: 'CONTRACT', label: 'Employment Contract' },
    { type: 'OTHER', label: 'Other' },
  ];

  const handleUpload = async (e, docType) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('document_type', docType);
      await userAPI.uploadDocument(userId, fd);
      const res = await userAPI.getUserDocuments(userId);
      setDocs(res.data || []);
    } catch { alert('Upload failed'); }
    finally { setUploading(false); }
  };

  if (loading) return <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-sm">Loading...</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {docTypes.map(dt => {
        const existing = docs.find(d => d.document_type === dt.type);
        return (
          <div key={dt.type} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${existing ? 'bg-green-500/10 dark:bg-green-500/20' : 'bg-slate-100 dark:bg-slate-700'}`}>
                <FileText className={`w-4 h-4 ${existing ? 'text-green-600 dark:text-green-400' : 'text-slate-500 dark:text-slate-400'}`} />
              </div>
              <div>
                <p className="text-slate-900 dark:text-white text-sm font-medium">{dt.label}</p>
                <p className="text-xs text-slate-500">{existing ? '✓ Uploaded' : 'Not uploaded'}</p>
              </div>
            </div>
            {existing ? (
              <a href={existing.file_url} target="_blank" rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 text-xs font-medium rounded-lg hover:bg-blue-500/20 dark:hover:bg-blue-500/30 transition-all">
                <Download className="w-3.5 h-3.5" /> View / Download
              </a>
            ) : (
              <label className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400 text-xs font-medium rounded-lg border border-dashed border-green-500/40 hover:bg-green-500/20 dark:hover:bg-green-500/30 transition-all cursor-pointer">
                <Plus className="w-3.5 h-3.5" /> {uploading ? 'Uploading...' : 'Upload'}
                <input type="file" className="hidden" onChange={e => handleUpload(e, dt.type)} disabled={uploading} />
              </label>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ── Main Employee Portal ──────────────────────────────────────────────────────
const EmployeePortal = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [userData, setUserData] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [salary, setSalary] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [uRes, attRes, salRes, leaveRes] = await Promise.all([
          userAPI.getCurrentUser(),
          attendanceAPI.getUserAttendance(user.id, new Date().toISOString().slice(0, 7)),
          salaryAPI.getUserSalary(user.id),
          leaveAPI.getUserLeaves(user.id),
        ]);
        setUserData(uRes.data);
        setAttendance(attRes.data || []);
        setSalary(salRes.data || []);
        setLeaves(leaveRes.data || []);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    })();
  }, [user.id]);

  if (loading) return <PageSpinner />;

  return (
    <div className="h-screen overflow-hidden bg-slate-50 dark:bg-slate-900 flex flex-col">
      <Navbar />
      <div className="flex flex-1 min-h-0">
        <Sidebar userRole="EMPLOYEE" collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(p => !p)} />

        <div className="flex-1 p-3 sm:p-6 overflow-y-auto min-h-0">
          <div className="mb-5">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">My Portal</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">Your personal information and records</p>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1.5 overflow-x-auto">
            {TABS.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-green-500/10 text-green-700 dark:bg-green-500/20 dark:text-green-400 border border-green-500/30'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {activeTab === 'overview' && userData && <OverviewTab userData={userData} attendance={attendance} salary={salary} leaves={leaves} />}
          {activeTab === 'attendance' && <MyAttendance userId={user.id} />}
          {activeTab === 'salary' && <MySalary userId={user.id} />}
          {activeTab === 'leaves' && <MyLeaves userId={user.id} />}
          {activeTab === 'documents' && <MyDocuments userId={user.id} />}
        </div>
      </div>
    </div>
  );
};

export default EmployeePortal;