import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import CustomerLayout from '../components/CustomerLayout';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';
import PriceTag from '../components/common/PriceTag';
import EmptyState from '../components/common/EmptyState';
import PageSpinner from '../components/common/PageSpinner';
import BookingHistoryModal from '../components/BookingHistoryModal';
import { useAuth } from '../context/AuthContext';
import { useOrgInfo } from '../hooks/useOrgInfo';
import { bookingAPI } from '../services/api';
import { loadRazorpayScript } from '../utils/razorpay';
import { CalendarCheck, History, Loader2 } from 'lucide-react';

const STATUS_TONE = { PENDING: 'amber', CONFIRMED: 'blue', CHECKED_IN: 'green', CHECKED_OUT: 'slate', CANCELLED: 'red' };
const STATUS_LABEL = { PENDING: 'Pending Payment', CONFIRMED: 'Confirmed', CHECKED_IN: 'Checked In', CHECKED_OUT: 'Checked Out', CANCELLED: 'Cancelled' };

const MyBookings = () => {
  const { orgId } = useParams();
  const { user } = useAuth();
  const { org } = useOrgInfo(orgId);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [historyId, setHistoryId] = useState(null);

  const fetchBookings = useCallback(async () => {
    try {
      const { data } = await bookingAPI.getBookings();
      setBookings(data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this reservation?')) return;
    setBusyId(id);
    try { await bookingAPI.cancelBooking(id); await fetchBookings(); }
    catch (err) { setError(err.response?.data?.error || 'Could not cancel this reservation.'); }
    finally { setBusyId(null); }
  };

  const handlePayNow = async (b) => {
    setBusyId(b.id); setError('');
    try {
      const { data: order } = await bookingAPI.createOrder(b.id);
      const scriptOk = await loadRazorpayScript();
      if (!scriptOk) { setError('Could not load the payment window.'); setBusyId(null); return; }
      const rzp = new window.Razorpay({
        key: order.key_id, amount: order.amount, currency: order.currency, order_id: order.order_id,
        name: org?.name || 'Room Booking', description: b.room_detail?.name,
        prefill: { name: `${user.first_name} ${user.last_name}`, email: user.email },
        theme: { color: '#22c55e' },
        handler: async (response) => {
          try {
            await bookingAPI.verifyPayment(b.id, {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            await fetchBookings();
          } catch (err) { setError('Payment succeeded but confirmation failed — contact the property.'); }
          finally { setBusyId(null); }
        },
        modal: { ondismiss: () => setBusyId(null) },
      });
      rzp.open();
    } catch (err) {
      setError(err.response?.data?.error || 'Payment gateway is not available right now.');
      setBusyId(null);
    }
  };

  if (loading) return <CustomerLayout orgName={org?.name}><PageSpinner label="Loading your bookings..." /></CustomerLayout>;

  return (
    <CustomerLayout orgName={org?.name}>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
        <CalendarCheck className="w-6 h-6 text-green-500" /> My Bookings
      </h1>

      {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-600 dark:text-red-400 text-sm">{error}</div>}

      {bookings.length === 0 ? (
        <Card><EmptyState icon={CalendarCheck} title="No bookings yet" description="Browse rooms to make your first reservation." /></Card>
      ) : (
        <div className="space-y-3">
          {bookings.map(b => {
            const busy = busyId === b.id;
            return (
              <Card key={b.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-900 dark:text-white">{b.room_detail?.name}</h3>
                    <Badge tone={STATUS_TONE[b.status]}>{STATUS_LABEL[b.status] || b.status}</Badge>
                  </div>
                  {b.property_name && <p className="text-xs text-slate-400">{b.property_name}</p>}
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                    {b.check_in} → {b.check_out} · {b.nights} night{b.nights !== 1 ? 's' : ''} · {b.guests} guest{b.guests !== 1 ? 's' : ''}
                  </p>
                  <PriceTag amount={b.total_amount} className="text-sm font-semibold text-slate-900 dark:text-white mt-1 inline-block" />
                </div>
                <div className="flex gap-2 items-center">
                  {b.status === 'PENDING' && (
                    <button onClick={() => handlePayNow(b)} disabled={busy} className="px-3 py-1.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xs font-semibold rounded-lg disabled:opacity-50 flex items-center gap-1.5">
                      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} Pay Now
                    </button>
                  )}
                  {(b.status === 'PENDING' || b.status === 'CONFIRMED') && (
                    <button onClick={() => handleCancel(b.id)} disabled={busy} className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-xs font-medium rounded-lg disabled:opacity-50">Cancel</button>
                  )}
                  <button onClick={() => setHistoryId(b.id)} title="History" className="p-1.5 hover:bg-slate-500/10 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg">
                    <History className="w-4 h-4" />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {historyId && <BookingHistoryModal bookingId={historyId} onClose={() => setHistoryId(null)} />}
    </CustomerLayout>
  );
};

export default MyBookings;
