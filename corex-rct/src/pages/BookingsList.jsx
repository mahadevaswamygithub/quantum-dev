import React, { useState, useEffect, useCallback } from 'react';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import RefreshButton from '../components/common/RefreshButton';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import PageSpinner from '../components/common/PageSpinner';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';
import PriceTag from '../components/common/PriceTag';
import EmptyState from '../components/common/EmptyState';
import SearchFilterBar from '../components/common/SearchFilterBar';
import BookingHistoryModal from '../components/BookingHistoryModal';
import RecordPaymentModal from '../components/RecordPaymentModal';
import CancelRequestDecisionModal from '../components/CancelRequestDecisionModal';
import WalkInModal from '../components/WalkInModal';
import { downloadBlob } from '../utils/downloadFile';
import { downloadVoucher } from '../utils/downloadVoucher';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { bookingAPI } from '../services/api';
import { CalendarCheck, Check, LogIn, LogOut, Ban, RotateCcw, History, Wallet, Download, MessageSquareWarning, UserPlus, FileDown } from 'lucide-react';

const STATUS_TONE = { PENDING: 'amber', CONFIRMED: 'blue', CHECKED_IN: 'green', CHECKED_OUT: 'slate', CANCELLED: 'red' };
const STATUS_LABEL = { PENDING: 'Pending Payment', CONFIRMED: 'Confirmed', CHECKED_IN: 'Checked In', CHECKED_OUT: 'Checked Out', CANCELLED: 'Cancelled' };
const statusLabel = (b) => (b.status === 'PENDING' && b.payment_method === 'AT_PROPERTY' ? 'Awaiting confirmation' : STATUS_LABEL[b.status] || b.status);

const BookingsList = () => {
  const { can } = usePermissions();
  const { user } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [historyId, setHistoryId] = useState(null);
  const [payFor, setPayFor] = useState(null);
  const [decideFor, setDecideFor] = useState(null);
  const [walkIn, setWalkIn] = useState(false);
  const exportCsv = async () => {
    try {
      const { data } = await bookingAPI.exportBookingsCsv({});
      downloadBlob(data, `bookings-last-30-days.csv`);
    } catch { alert('Could not export bookings.'); }
  };

  const fetchData = useCallback(async () => {
    try {
      const bookingsRes = await bookingAPI.getBookings();
      setBookings(bookingsRes.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  const live = useAutoRefresh(fetchData, { interval: 30000 });

  const openRequests = bookings.filter(b => b.cancel_request_status === 'PENDING');
  const filtered = statusFilter === 'ALL' ? bookings
    : statusFilter === 'CANCEL_REQUESTS' ? openRequests
    : bookings.filter(b => b.status === statusFilter);

  const runAction = async (id, fn) => {
    setActionLoadingId(id);
    try { await fn(id); await fetchData(); }
    catch (err) { alert(err.response?.data?.error || 'Action failed'); }
    finally { setActionLoadingId(null); }
  };

  // Shared by the table (desktop) and the cards (phones).
  const renderStatus = (b) => (
    <>
      <Badge tone={STATUS_TONE[b.status]}>{statusLabel(b)}</Badge>
      {b.status !== 'CANCELLED' && (
        Number(b.balance_due) <= 0
          ? <div className="text-xs text-green-600 dark:text-green-400 mt-1">Paid in full</div>
          : <div className="text-xs text-slate-400 mt-1">
              {Number(b.amount_paid) > 0 ? `Paid ₹${Number(b.amount_paid).toLocaleString('en-IN')} · ` : ''}₹{Number(b.balance_due).toLocaleString('en-IN')} due
            </div>
      )}
      {b.payment_method === 'AT_PROPERTY' && <div className="text-xs text-slate-400 mt-1">Pays at property</div>}
      {b.cancel_request_status === 'PENDING' && (
        <div className="mt-1"><Badge tone="amber">Cancel requested</Badge></div>
      )}
    </>
  );

  const ACT = 'p-2.5 md:p-1.5 rounded-lg disabled:opacity-50';  // bigger tap targets on phones
  const renderActions = (b, busy) => (
    <div className="flex flex-wrap items-center gap-1 md:gap-1.5">
      {can('bookings.manage') && b.cancel_request_status === 'PENDING' && (
        <button disabled={busy} onClick={() => setDecideFor(b)} title="Review cancellation request" aria-label="Review cancellation request" className={`${ACT} hover:bg-amber-500/10 text-amber-500`}><MessageSquareWarning className="w-4 h-4" /></button>
      )}
      {can('bookings.manage') && b.status === 'PENDING' && (
        <button disabled={busy} onClick={() => runAction(b.id, bookingAPI.confirmBooking)} title="Confirm" aria-label="Confirm" className={`${ACT} hover:bg-blue-500/10 text-blue-500`}><Check className="w-4 h-4" /></button>
      )}
      {can('bookings.manage') && b.status === 'CONFIRMED' && (
        <button disabled={busy} onClick={() => runAction(b.id, bookingAPI.checkInBooking)} title="Check In" aria-label="Check in" className={`${ACT} hover:bg-green-500/10 text-green-500`}><LogIn className="w-4 h-4" /></button>
      )}
      {can('bookings.manage') && b.status === 'CHECKED_IN' && (
        <button disabled={busy} onClick={() => runAction(b.id, bookingAPI.checkOutBooking)} title="Check Out" aria-label="Check out" className={`${ACT} hover:bg-slate-500/10 text-slate-500`}><LogOut className="w-4 h-4" /></button>
      )}
      {can('bookings.manage') && (b.status === 'PENDING' || b.status === 'CONFIRMED') && (
        <button disabled={busy} onClick={() => window.confirm('Cancel this reservation?') && runAction(b.id, bookingAPI.cancelBooking)} title="Cancel" aria-label="Cancel reservation" className={`${ACT} hover:bg-red-500/10 text-red-500`}><Ban className="w-4 h-4" /></button>
      )}
      {can('payments.collect') && Number(b.balance_due) > 0 && ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'].includes(b.status) && (
        <button disabled={busy} onClick={() => setPayFor(b)} title="Record payment" aria-label="Record payment" className={`${ACT} hover:bg-green-500/10 text-green-600`}><Wallet className="w-4 h-4" /></button>
      )}
      {can('payments.refund') && Number(b.amount_paid) > 0 && (
        <button disabled={busy} onClick={() => window.confirm('Refund this payment and cancel the reservation?') && runAction(b.id, bookingAPI.refundBooking)} title="Refund" aria-label="Refund" className={`${ACT} hover:bg-amber-500/10 text-amber-500`}><RotateCcw className="w-4 h-4" /></button>
      )}
      <button onClick={() => downloadVoucher(b.id).catch(() => alert('Could not download the confirmation.'))} title="Download confirmation (PDF)" aria-label="Download confirmation" className={`${ACT} hover:bg-slate-500/10 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200`}><Download className="w-4 h-4" /></button>
      <button onClick={() => setHistoryId(b.id)} title="History" aria-label="History" className={`${ACT} hover:bg-slate-500/10 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200`}><History className="w-4 h-4" /></button>
    </div>
  );

  if (loading) return <PageSpinner label="Loading bookings..." />;

  return (
    <div className="h-screen overflow-hidden bg-slate-50 dark:bg-slate-900 flex flex-col">
      <Navbar />
      <div className="flex flex-1 min-h-0">
        <Sidebar userRole={user.role} collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(p => !p)} />

        <div className="flex-1 p-3 sm:p-6 overflow-y-auto min-h-0">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4 sm:mb-6">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CalendarCheck className="w-6 h-6 text-green-500" /> Bookings
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">{filtered.length} of {bookings.length} reservations</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {can('bookings.manage') && (
                <button type="button" onClick={() => setWalkIn(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold">
                  <UserPlus className="w-4 h-4" /> Walk-in booking
                </button>
              )}
              <button type="button" onClick={exportCsv} title="Bookings with check-in in the last 30 days" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-white">
                <FileDown className="w-4 h-4" /> Export CSV
              </button>
              <RefreshButton onClick={live.refresh} refreshing={live.refreshing} lastUpdated={live.lastUpdated} />
            </div>
          </div>

          <SearchFilterBar>
            <select
              value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="CANCEL_REQUESTS">Cancellation requests ({openRequests.length})</option>
              {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </SearchFilterBar>

          {openRequests.length > 0 && statusFilter !== 'CANCEL_REQUESTS' && (
            <button type="button" onClick={() => setStatusFilter('CANCEL_REQUESTS')}
              className="mb-4 w-full flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-left text-sm text-amber-900 dark:text-amber-200 hover:border-amber-300">
              <MessageSquareWarning className="w-5 h-5 flex-shrink-0" />
              <span><b>{openRequests.length} cancellation request{openRequests.length > 1 ? 's' : ''}</b> waiting for your decision - guests asked to cancel after the free-cancellation window.</span>
              <span className="ml-auto font-semibold whitespace-nowrap">Review →</span>
            </button>
          )}
          <Card className="overflow-hidden">
            {filtered.length === 0 ? (
              <EmptyState icon={CalendarCheck} title="No reservations" description="Bookings made by your customers will show up here." />
            ) : (
              <>
              {/* Phones: one card per booking, same details and actions as the table. */}
              <ul className="md:hidden divide-y divide-slate-100 dark:divide-slate-700/50">
                {filtered.map(b => (
                  <li key={b.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900 dark:text-white truncate">{b.customer_name}</div>
                        {b.customer_phone
                          ? <a href={`tel:${b.customer_phone}`} className="text-xs text-slate-500 dark:text-slate-300 hover:underline">{b.customer_phone}</a>
                          : <div className="text-xs text-slate-400 truncate">{b.customer_email}</div>}
                      </div>
                      <PriceTag amount={b.total_amount} className="font-semibold text-slate-900 dark:text-white whitespace-nowrap" />
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-300">
                      {b.room_detail?.name}{b.property_name ? <span className="text-slate-400"> · {b.property_name}</span> : null}
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      {b.check_in} → {b.check_out} · {b.nights} night{b.nights !== 1 ? 's' : ''} · {b.guests} guest{b.guests !== 1 ? 's' : ''}
                    </div>
                    <div>{renderStatus(b)}</div>
                    <div className="-ml-1.5">{renderActions(b, actionLoadingId === b.id)}</div>
                  </li>
                ))}
              </ul>
              <div className="hidden md:block overflow-x-auto">
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
                            {b.customer_phone && <a href={`tel:${b.customer_phone}`} className="text-xs text-slate-500 dark:text-slate-300 hover:underline">{b.customer_phone}</a>}
                          </td>
                          <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{b.property_name || '-'}</td>
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{b.room_detail?.name}</td>
                          <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            {b.check_in} → {b.check_out}
                            <div className="text-xs text-slate-400">{b.nights} night{b.nights !== 1 ? 's' : ''} · {b.guests} guest{b.guests !== 1 ? 's' : ''}</div>
                          </td>
                          <td className="px-4 py-3"><PriceTag amount={b.total_amount} className="font-medium text-slate-900 dark:text-white" /></td>
                          <td className="px-4 py-3">{renderStatus(b)}</td>
                          <td className="px-4 py-3">{renderActions(b, busy)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              </>
            )}
          </Card>
        </div>
      </div>

      {historyId && <BookingHistoryModal bookingId={historyId} onClose={() => setHistoryId(null)} />}
      <RecordPaymentModal booking={payFor} onClose={() => setPayFor(null)} onSaved={fetchData} />
      <WalkInModal open={walkIn} onClose={() => setWalkIn(false)} onSaved={fetchData} />
      <CancelRequestDecisionModal booking={decideFor} canRefund={can('payments.refund')} onClose={() => setDecideFor(null)} onSaved={fetchData} />
    </div>
  );
};

export default BookingsList;
