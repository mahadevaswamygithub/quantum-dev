import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import PageSpinner from '../components/common/PageSpinner';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';
import PriceTag from '../components/common/PriceTag';
import EmptyState from '../components/common/EmptyState';
import SearchFilterBar from '../components/common/SearchFilterBar';
import { useAuth } from '../context/AuthContext';
import { bookingAPI, userAPI } from '../services/api';
import { CalendarCheck, Check, LogIn, LogOut, Ban, RotateCcw } from 'lucide-react';

const STATUS_TONE = { PENDING: 'amber', CONFIRMED: 'blue', CHECKED_IN: 'green', CHECKED_OUT: 'slate', CANCELLED: 'red' };
const STATUS_LABEL = { PENDING: 'Pending Payment', CONFIRMED: 'Confirmed', CHECKED_IN: 'Checked In', CHECKED_OUT: 'Checked Out', CANCELLED: 'Cancelled' };

const BookingsList = () => {
  const { user } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [bookingsRes, usersRes] = await Promise.all([bookingAPI.getBookings(), userAPI.getUsers()]);
      setBookings(bookingsRes.data || []);
      setAllUsers(usersRes.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = statusFilter === 'ALL' ? bookings : bookings.filter(b => b.status === statusFilter);

  const runAction = async (id, fn) => {
    setActionLoadingId(id);
    try { await fn(id); await fetchData(); }
    catch (err) { alert(err.response?.data?.error || 'Action failed'); }
    finally { setActionLoadingId(null); }
  };

  if (loading) return <PageSpinner label="Loading bookings..." />;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Navbar />
      <div className="flex">
        <Sidebar userRole={user.role} users={allUsers} collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(p => !p)} />

        <div className="flex-1 p-6 overflow-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CalendarCheck className="w-6 h-6 text-green-500" /> Bookings
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">{filtered.length} of {bookings.length} reservations</p>
            </div>
          </div>

          <SearchFilterBar>
            <select
              value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="ALL">All Statuses</option>
              {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </SearchFilterBar>

          <Card className="overflow-hidden">
            {filtered.length === 0 ? (
              <EmptyState icon={CalendarCheck} title="No reservations" description="Bookings made by your customers will show up here." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 text-left text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                      <th className="px-4 py-3 font-medium">Guest</th>
                      <th className="px-4 py-3 font-medium">Property</th>
                      <th className="px-4 py-3 font-medium">Room</th>
                      <th className="px-4 py-3 font-medium">Dates</th>
                      <th className="px-4 py-3 font-medium">Amount</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(b => {
                      const busy = actionLoadingId === b.id;
                      return (
                        <tr key={b.id} className="border-b border-slate-100 dark:border-slate-700/50 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                          <td className="px-4 py-3">
                            <div className="text-slate-900 dark:text-white font-medium">{b.customer_name}</div>
                            <div className="text-xs text-slate-400">{b.customer_email}</div>
                          </td>
                          <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{b.property_name || '—'}</td>
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{b.room_detail?.name}</td>
                          <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            {b.check_in} → {b.check_out}
                            <div className="text-xs text-slate-400">{b.nights} night{b.nights !== 1 ? 's' : ''} · {b.guests} guest{b.guests !== 1 ? 's' : ''}</div>
                          </td>
                          <td className="px-4 py-3"><PriceTag amount={b.total_amount} className="font-medium text-slate-900 dark:text-white" /></td>
                          <td className="px-4 py-3">
                            <Badge tone={STATUS_TONE[b.status]}>{STATUS_LABEL[b.status] || b.status}</Badge>
                            {b.payment_status && <div className="text-xs text-slate-400 mt-1">Payment: {b.payment_status}</div>}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              {b.status === 'PENDING' && (
                                <button disabled={busy} onClick={() => runAction(b.id, bookingAPI.confirmBooking)} title="Confirm" className="p-1.5 hover:bg-blue-500/10 text-blue-500 rounded-lg disabled:opacity-50"><Check className="w-4 h-4" /></button>
                              )}
                              {b.status === 'CONFIRMED' && (
                                <button disabled={busy} onClick={() => runAction(b.id, bookingAPI.checkInBooking)} title="Check In" className="p-1.5 hover:bg-green-500/10 text-green-500 rounded-lg disabled:opacity-50"><LogIn className="w-4 h-4" /></button>
                              )}
                              {b.status === 'CHECKED_IN' && (
                                <button disabled={busy} onClick={() => runAction(b.id, bookingAPI.checkOutBooking)} title="Check Out" className="p-1.5 hover:bg-slate-500/10 text-slate-500 rounded-lg disabled:opacity-50"><LogOut className="w-4 h-4" /></button>
                              )}
                              {(b.status === 'PENDING' || b.status === 'CONFIRMED') && (
                                <button disabled={busy} onClick={() => window.confirm('Cancel this reservation?') && runAction(b.id, bookingAPI.cancelBooking)} title="Cancel" className="p-1.5 hover:bg-red-500/10 text-red-500 rounded-lg disabled:opacity-50"><Ban className="w-4 h-4" /></button>
                              )}
                              {b.payment_status === 'PAID' && (
                                <button disabled={busy} onClick={() => window.confirm('Refund this payment and cancel the reservation?') && runAction(b.id, bookingAPI.refundBooking)} title="Refund" className="p-1.5 hover:bg-amber-500/10 text-amber-500 rounded-lg disabled:opacity-50"><RotateCcw className="w-4 h-4" /></button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default BookingsList;
