import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import PageSpinner from '../components/common/PageSpinner';
import Avatar from '../components/common/Avatar';
import { useAuth } from '../context/AuthContext';
import { userAPI, tenantAPI, attendanceAPI, salaryAPI, leaveAPI } from '../services/api';
import {
  ArrowLeft, ChevronRight, User, Mail, Phone, Calendar, Shield, Building2,
  Clock, DollarSign, CalendarDays, Briefcase, Camera, Download, Plus,
  CheckCircle, XCircle, Edit, FileText, Wallet
} from 'lucide-react';

const TABS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'attendance', label: 'Attendance', icon: Clock },
  { id: 'salary', label: 'Salary', icon: DollarSign },
  { id: 'leaves', label: 'Leaves', icon: CalendarDays },
  { id: 'documents', label: 'Documents', icon: Briefcase },
];

// ── Sub-components ────────────────────────────────────────────────────────────

const InfoRow = ({ label, value, icon: Icon }) => (
  <div className="flex items-start gap-3 py-3 border-b border-slate-100 dark:border-slate-700/50 last:border-0">
    {Icon && <Icon className="w-4 h-4 text-slate-400 dark:text-slate-500 mt-0.5 flex-shrink-0" />}
    <div>
      <p className="text-xs text-slate-500 dark:text-slate-500 mb-0.5">{label}</p>
      <p className="text-sm text-slate-900 dark:text-white font-medium">{value || '—'}</p>
    </div>
  </div>
);

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

// ── Profile Tab ───────────────────────────────────────────────────────────────
const ProfileTab = ({ userData, onEditPhoto, uploadingPhoto }) => (
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
    {/* Avatar card */}
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 text-center">
      <div className="relative inline-block mb-4">
        <Avatar
          src={userData.profile_picture}
          initials={`${userData.first_name?.[0] || ''}${userData.last_name?.[0] || ''}`}
          className="w-24 h-24 rounded-full text-3xl mx-auto"
        />
        <button
          onClick={onEditPhoto}
          disabled={uploadingPhoto}
          title="Change photo"
          className="absolute bottom-0 right-0 w-7 h-7 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center transition-all disabled:opacity-50"
        >
          <Camera className="w-3.5 h-3.5 text-white" />
        </button>
      </div>
      <h3 className="text-slate-900 dark:text-white font-bold text-lg">{userData.first_name} {userData.last_name}</h3>
      <p className="text-slate-500 dark:text-slate-400 text-sm">{userData.email}</p>
      <div className="mt-3 flex justify-center gap-2">
        <Badge label={userData.role} color="blue" />
        <Badge label={userData.is_active ? 'Active' : 'Inactive'} color={userData.is_active ? 'green' : 'red'} />
      </div>
    </div>

    {/* Details */}
    <div className="lg:col-span-2 space-y-4">
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
        <h4 className="text-slate-500 dark:text-slate-400 font-semibold text-sm mb-3 uppercase tracking-wide">Personal Information</h4>
        <InfoRow label="Full Name" value={`${userData.first_name} ${userData.last_name}`} icon={User} />
        <InfoRow label="Email" value={userData.email} icon={Mail} />
        <InfoRow label="Phone" value={userData.phone} icon={Phone} />
        <InfoRow label="Date of Birth" value={userData.date_of_birth} icon={Calendar} />
        <InfoRow label="Address" value={userData.address} icon={Building2} />
      </div>

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
        <h4 className="text-slate-500 dark:text-slate-400 font-semibold text-sm mb-3 uppercase tracking-wide">Work Information</h4>
        <InfoRow label="Role" value={userData.role} icon={Shield} />
        <InfoRow label="Organization" value={userData.organization_name} icon={Building2} />
        <InfoRow label="Employee ID" value={userData.employee_id || userData.id} icon={Briefcase} />
        <InfoRow label="Date of Joining" value={userData.created_at ? new Date(userData.created_at).toLocaleDateString() : '—'} icon={Calendar} />
      </div>
    </div>
  </div>
);

// ── Attendance Tab ────────────────────────────────────────────────────────────
const AttendanceTab = ({ userId }) => {
  const [records, setRecords] = useState([]);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ present: 0, absent: 0, leave: 0, total: 0 });

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await attendanceAPI.getUserAttendance(userId, month);
        const data = res.data || [];
        setRecords(data);
        setSummary({
          present: data.filter(r => r.status === 'PRESENT').length,
          absent: data.filter(r => r.status === 'ABSENT').length,
          leave: data.filter(r => r.status === 'LEAVE').length,
          total: data.length,
        });
      } catch { setRecords([]); }
      finally { setLoading(false); }
    })();
  }, [userId, month]);

  const statusColor = { PRESENT: 'green', ABSENT: 'red', LEAVE: 'yellow', HALF_DAY: 'purple' };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Present', value: summary.present, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-500/10' },
          { label: 'Absent', value: summary.absent, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10' },
          { label: 'On Leave', value: summary.leave, color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-500/10' },
          { label: 'Total Days', value: summary.total, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10' },
        ].map((s, i) => (
          <div key={i} className={`${s.bg} rounded-xl p-4 text-center`}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Month picker + table */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h4 className="font-semibold text-slate-900 dark:text-white text-sm">Attendance Records</h4>
          <input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        {loading ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-sm">Loading...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-700/50">
                <tr>
                  {['Date', 'Day', 'Status', 'Check In', 'Check Out', 'Hours'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {records.length === 0 ? (
                  <tr><td colSpan="6" className="px-5 py-8 text-center text-slate-500 dark:text-slate-400 text-sm">No records for this month</td></tr>
                ) : records.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="px-5 py-3 text-sm text-slate-900 dark:text-white">{r.date}</td>
                    <td className="px-5 py-3 text-sm text-slate-500 dark:text-slate-400">{new Date(r.date).toLocaleDateString('en', { weekday: 'short' })}</td>
                    <td className="px-5 py-3"><Badge label={r.status} color={statusColor[r.status] || 'blue'} /></td>
                    <td className="px-5 py-3 text-sm text-slate-500 dark:text-slate-400">{r.check_in || '—'}</td>
                    <td className="px-5 py-3 text-sm text-slate-500 dark:text-slate-400">{r.check_out || '—'}</td>
                    <td className="px-5 py-3 text-sm text-slate-500 dark:text-slate-400">{r.hours_worked ? `${r.hours_worked}h` : '—'}</td>
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

// ── Salary Tab ────────────────────────────────────────────────────────────────
const SalaryTab = ({ userId, isAdminView = false }) => {
  const [records, setRecords] = useState([]);
  const [advances, setAdvances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdvance, setShowAdvance] = useState(false);
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceNote, setAdvanceNote] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [salRes, advRes] = await Promise.all([
          salaryAPI.getUserSalary(userId),
          salaryAPI.getSalaryAdvances(userId),
        ]);
        setRecords(salRes.data || []);
        setAdvances(advRes.data || []);
      } catch { setRecords([]); setAdvances([]); }
      finally { setLoading(false); }
    })();
  }, [userId]);

  const handleDownloadPayslip = async (salaryId) => {
    try {
      const res = await salaryAPI.downloadPayslip(salaryId);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `payslip_${salaryId}.pdf`;
      a.click();
    } catch { alert('Failed to download payslip'); }
  };

  const handleAdvanceRequest = async () => {
    try {
      await salaryAPI.requestAdvance(userId, { amount: advanceAmount, note: advanceNote });
      setShowAdvance(false);
      setAdvanceAmount('');
      setAdvanceNote('');
    } catch { alert('Failed to request advance'); }
  };

  if (loading) return <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-sm">Loading...</div>;

  return (
    <div className="space-y-4">
      {/* Advance button */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowAdvance(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-600 dark:bg-yellow-500/20 dark:hover:bg-yellow-500/30 dark:text-yellow-400 text-sm font-medium rounded-lg transition-all border border-yellow-500/30"
        >
          <Wallet className="w-4 h-4" /> Request Advance
        </button>
      </div>

      {showAdvance && (
        <div className="bg-white dark:bg-slate-800 border border-yellow-500/30 rounded-xl p-5">
          <h4 className="text-slate-900 dark:text-white font-semibold text-sm mb-3">Request Salary Advance</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Amount (₹)</label>
              <input type="number" value={advanceAmount} onChange={e => setAdvanceAmount(e.target.value)}
                className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="5000" />
            </div>
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Note</label>
              <input type="text" value={advanceNote} onChange={e => setAdvanceNote(e.target.value)}
                className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="Reason..." />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowAdvance(false)} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white text-sm rounded-lg transition-all">Cancel</button>
            <button onClick={handleAdvanceRequest} className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-all">Submit Request</button>
          </div>
        </div>
      )}

      {/* Salary records */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <h4 className="font-semibold text-slate-900 dark:text-white text-sm">Salary History</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-700/50">
              <tr>
                {['Month', 'Days Present', 'Daily Rate', 'Gross', 'Deductions', 'Net Pay', 'Status', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {records.length === 0 ? (
                <tr><td colSpan="8" className="px-4 py-8 text-center text-slate-500 dark:text-slate-400 text-sm">No salary records</td></tr>
              ) : records.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <td className="px-4 py-3 text-sm text-slate-900 dark:text-white font-medium">{r.month}</td>
                  <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">{r.days_present}</td>
                  <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">₹{r.daily_rate}</td>
                  <td className="px-4 py-3 text-sm text-slate-900 dark:text-white">₹{r.gross_salary?.toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm text-red-600 dark:text-red-400">-₹{r.deductions?.toLocaleString() || 0}</td>
                  <td className="px-4 py-3 text-sm text-green-600 dark:text-green-400 font-semibold">₹{r.net_salary?.toLocaleString()}</td>
                  <td className="px-4 py-3"><Badge label={r.status} color={r.status === 'PAID' ? 'green' : 'yellow'} /></td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleDownloadPayslip(r.id)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors" title="Download Payslip">
                      <Download className="w-4 h-4 text-blue-400" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Advance records */}
      {advances.length > 0 && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700">
            <h4 className="font-semibold text-slate-900 dark:text-white text-sm">Advance Requests</h4>
          </div>
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-700/50">
              <tr>
                {['Date', 'Amount', 'Note', 'Status'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {advances.map((a, i) => (
                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <td className="px-4 py-3 text-sm text-slate-900 dark:text-white">{a.date}</td>
                  <td className="px-4 py-3 text-sm text-yellow-600 dark:text-yellow-400 font-semibold">₹{a.amount?.toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">{a.note || '—'}</td>
                  <td className="px-4 py-3"><Badge label={a.status} color={a.status === 'APPROVED' ? 'green' : a.status === 'REJECTED' ? 'red' : 'yellow'} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ── Leaves Tab ────────────────────────────────────────────────────────────────
const LeavesTab = ({ userId, isAdminView = false }) => {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showApply, setShowApply] = useState(false);
  const [form, setForm] = useState({ leave_type: 'CASUAL', from_date: '', to_date: '', reason: '' });

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await leaveAPI.getUserLeaves(userId);
        setLeaves(res.data || []);
      } catch { setLeaves([]); }
      finally { setLoading(false); }
    })();
  }, [userId]);

  const handleApply = async () => {
    try {
      await leaveAPI.applyLeave(userId, form);
      setShowApply(false);
      const res = await leaveAPI.getUserLeaves(userId);
      setLeaves(res.data || []);
    } catch { alert('Failed to apply leave'); }
  };

  const handleApprove = async (leaveId) => {
    try { await leaveAPI.approveLeave(leaveId); const res = await leaveAPI.getUserLeaves(userId); setLeaves(res.data || []); }
    catch { alert('Failed'); }
  };

  const handleReject = async (leaveId) => {
    try { await leaveAPI.rejectLeave(leaveId); const res = await leaveAPI.getUserLeaves(userId); setLeaves(res.data || []); }
    catch { alert('Failed'); }
  };

  if (loading) return <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-sm">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowApply(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-all">
          <Plus className="w-3.5 h-3.5" /> Apply Leave
        </button>
      </div>

      {showApply && (
        <div className="bg-white dark:bg-slate-800 border border-green-500/30 rounded-xl p-5">
          <h4 className="text-slate-900 dark:text-white font-semibold text-sm mb-3">Apply for Leave</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Leave Type</label>
              <select value={form.leave_type} onChange={e => setForm(f => ({ ...f, leave_type: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                <option value="CASUAL">Casual Leave</option>
                <option value="SICK">Sick Leave</option>
                <option value="ANNUAL">Annual Leave</option>
                <option value="UNPAID">Unpaid Leave</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">From Date</label>
              <input type="date" value={form.from_date} onChange={e => setForm(f => ({ ...f, from_date: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">To Date</label>
              <input type="date" value={form.to_date} onChange={e => setForm(f => ({ ...f, to_date: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Reason</label>
              <input type="text" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="Reason..." />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowApply(false)} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white text-sm rounded-lg">Cancel</button>
            <button onClick={handleApply} className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg">Submit</button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <h4 className="font-semibold text-slate-900 dark:text-white text-sm">Leave Records</h4>
        </div>
        <table className="w-full">
          <thead className="bg-slate-50 dark:bg-slate-700/50">
            <tr>
              {['Type', 'From', 'To', 'Days', 'Reason', 'Status', ...(isAdminView ? ['Actions'] : [])].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {leaves.length === 0 ? (
              <tr><td colSpan="7" className="px-4 py-8 text-center text-slate-500 dark:text-slate-400 text-sm">No leave records</td></tr>
            ) : leaves.map((l, i) => (
              <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                <td className="px-4 py-3"><Badge label={l.leave_type} color="blue" /></td>
                <td className="px-4 py-3 text-sm text-slate-900 dark:text-white">{l.from_date}</td>
                <td className="px-4 py-3 text-sm text-slate-900 dark:text-white">{l.to_date}</td>
                <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">{l.days}</td>
                <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 max-w-[150px] truncate">{l.reason}</td>
                <td className="px-4 py-3"><Badge label={l.status} color={l.status === 'APPROVED' ? 'green' : l.status === 'REJECTED' ? 'red' : 'yellow'} /></td>
                {isAdminView && (
                  <td className="px-4 py-3">
                    {l.status === 'PENDING' && (
                      <div className="flex gap-1">
                        <button onClick={() => handleApprove(l.id)} className="p-1 hover:bg-green-500/20 rounded transition-all" title="Approve">
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        </button>
                        <button onClick={() => handleReject(l.id)} className="p-1 hover:bg-red-500/20 rounded transition-all" title="Reject">
                          <XCircle className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ── Documents Tab ─────────────────────────────────────────────────────────────
const DocumentsTab = ({ userId }) => {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await userAPI.getUserDocuments(userId);
        setDocs(res.data || []);
      } catch { setDocs([]); }
      finally { setLoading(false); }
    })();
  }, [userId]);

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

  const docTypes = [
    { type: 'AADHAAR', label: 'Aadhaar Card' },
    { type: 'PAN', label: 'PAN Card' },
    { type: 'PASSPORT', label: 'Passport' },
    { type: 'OFFER_LETTER', label: 'Offer Letter' },
    { type: 'CONTRACT', label: 'Employment Contract' },
    { type: 'OTHER', label: 'Other' },
  ];

  if (loading) return <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-sm">Loading...</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {docTypes.map(dt => {
        const existing = docs.find(d => d.document_type === dt.type);
        return (
          <div key={dt.type} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${existing ? 'bg-green-500/10 dark:bg-green-500/20' : 'bg-slate-100 dark:bg-slate-700'}`}>
                <FileText className={`w-4 h-4 ${existing ? 'text-green-600 dark:text-green-400' : 'text-slate-400'}`} />
              </div>
              <div>
                <p className="text-slate-900 dark:text-white text-sm font-medium">{dt.label}</p>
                <p className="text-xs text-slate-500 dark:text-slate-500">{existing ? 'Uploaded' : 'Not uploaded'}</p>
              </div>
            </div>
            {existing ? (
              <div className="flex gap-2">
                <a href={existing.file_url} target="_blank" rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 text-xs font-medium rounded-lg hover:bg-blue-500/20 dark:hover:bg-blue-500/30 transition-all">
                  <Download className="w-3.5 h-3.5" /> Download
                </a>
                <label className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 text-xs font-medium rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-all cursor-pointer">
                  <Edit className="w-3.5 h-3.5" /> Replace
                  <input type="file" className="hidden" onChange={e => handleUpload(e, dt.type)} />
                </label>
              </div>
            ) : (
              <label className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400 text-xs font-medium rounded-lg hover:bg-green-500/20 dark:hover:bg-green-500/30 transition-all cursor-pointer border border-dashed border-green-500/40">
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

// ── Main Component ────────────────────────────────────────────────────────────
const UserDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: currentUser, updateUser: updateCurrentUser } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const [userData, setUserData] = useState(null);
  const [allOrgs, setAllOrgs] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef(null);

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await userAPI.uploadProfilePicture(id, fd);
      setUserData(data);
      // Keep the navbar/session avatar in sync when editing your own photo.
      if (String(currentUser.id) === String(id)) updateCurrentUser({ profile_picture: data.profile_picture });
    } catch { alert('Failed to upload photo'); }
    finally { setUploadingPhoto(false); }
  };

  const isMSP = currentUser.role === 'MSP_ADMIN' || currentUser.role === 'MSP_USER';
  const basePath = isMSP ? '/msp' : '/stp';

  useEffect(() => {
    (async () => {
      try {
        const [uRes, orgsRes, usersRes] = await Promise.all([
          userAPI.getUserById(id),
          tenantAPI.getTenants(),
          userAPI.getUsers(),
        ]);
        setUserData(uRes.data);
        setAllOrgs(orgsRes.data || []);
        setAllUsers(usersRes.data || []);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    })();
  }, [id]);

  if (loading) return <PageSpinner />;

  if (!userData) return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
      <p className="text-slate-500 dark:text-slate-400">User not found</p>
    </div>
  );

  return (
    <div className="h-screen overflow-hidden bg-slate-50 dark:bg-slate-900 flex flex-col">
      <Navbar />
      <div className="flex flex-1 min-h-0">
        <Sidebar userRole={currentUser.role} tenants={allOrgs} users={allUsers} collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(p => !p)} />

        <div className="flex-1 p-6 overflow-y-auto min-h-0">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-5">
            <button onClick={() => navigate(`${basePath}/users`)} className="hover:text-slate-900 dark:hover:text-white flex items-center gap-1 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Users
            </button>
            <ChevronRight className="w-3 h-3" />
            <span className="text-slate-900 dark:text-white">{userData.first_name} {userData.last_name}</span>
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

          {/* Hidden input backing the avatar's camera button */}
          <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />

          {/* Tab Content */}
          {activeTab === 'profile' && (
            <ProfileTab
              userData={userData}
              onEditPhoto={() => photoInputRef.current?.click()}
              uploadingPhoto={uploadingPhoto}
            />
          )}
          {activeTab === 'attendance' && <AttendanceTab userId={id} />}
          {activeTab === 'salary' && <SalaryTab userId={id} isAdminView={true} />}
          {activeTab === 'leaves' && <LeavesTab userId={id} isAdminView={true} />}
          {activeTab === 'documents' && <DocumentsTab userId={id} />}
        </div>
      </div>
    </div>
  );
};

export default UserDetail;