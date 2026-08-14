import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import CustomerLayout from '../components/CustomerLayout';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';
import PriceTag from '../components/common/PriceTag';
import ImageGallery from '../components/common/ImageGallery';
import DateRangePicker from '../components/common/DateRangePicker';
import PageSpinner from '../components/common/PageSpinner';
import { useAuth } from '../context/AuthContext';
import { useOrgInfo } from '../hooks/useOrgInfo';
import { bookingAPI } from '../services/api';
import { loadRazorpayScript } from '../utils/razorpay';
import { Users as UsersIcon, Loader2, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';

const ROOM_TYPE_LABELS = {
  SINGLE: 'Single Room', DOUBLE: 'Double Room', SUITE: 'Suite',
  DELUXE: 'Deluxe Room', CONFERENCE: 'Conference Room', OTHER: 'Other',
};

const RoomDetail = () => {
  const { orgId, propertyId, roomId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { org } = useOrgInfo(orgId);

  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dates, setDates] = useState({
    checkIn: searchParams.get('check_in') || '',
    checkOut: searchParams.get('check_out') || '',
  });
  const [guests, setGuests] = useState(1);
  const [specialRequests, setSpecialRequests] = useState('');
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [paymentPending, setPaymentPending] = useState(false);

  const fetchRoom = useCallback(async () => {
    try {
      const { data } = await bookingAPI.getRoom(roomId);
      setRoom(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [roomId]);

  useEffect(() => { fetchRoom(); }, [fetchRoom]);

  const nights = dates.checkIn && dates.checkOut
    ? Math.max(0, Math.round((new Date(dates.checkOut) - new Date(dates.checkIn)) / 86400000))
    : 0;
  const total = room ? nights * Number(room.price_per_night) : 0;

  const handleBook = async () => {
    if (!dates.checkIn || !dates.checkOut) { setError('Choose your check-in and check-out dates.'); return; }
    setError(''); setBooking(true);
    try {
      const { data: reservation } = await bookingAPI.createBooking({
        room: room.id, check_in: dates.checkIn, check_out: dates.checkOut,
        guests, special_requests: specialRequests,
      });

      let order;
      try {
        ({ data: order } = await bookingAPI.createOrder(reservation.id));
      } catch (err) {
        if (err.response?.status === 503) {
          // Backend has no Razorpay keys configured yet — the reservation
          // still exists (PENDING), just tell the guest payment isn't
          // wired up rather than pretending the booking failed outright.
          setPaymentPending(true);
          setBooking(false);
          return;
        }
        throw err;
      }

      const scriptOk = await loadRazorpayScript();
      if (!scriptOk) { setError('Could not load the payment window. Check your connection and try again.'); setBooking(false); return; }

      const rzp = new window.Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        order_id: order.order_id,
        name: org?.name || 'Room Booking',
        description: room.name,
        prefill: { name: `${user.first_name} ${user.last_name}`, email: user.email },
        theme: { color: '#22c55e' },
        handler: async (response) => {
          try {
            await bookingAPI.verifyPayment(reservation.id, {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            setSuccess(true);
          } catch (err) {
            setError('Payment succeeded but confirmation failed — check My Bookings, or contact the property.');
          } finally {
            setBooking(false);
          }
        },
        modal: {
          ondismiss: () => {
            setBooking(false);
            setPaymentPending(true); // reservation exists as PENDING; they can retry from My Bookings
          },
        },
      });
      rzp.open();
    } catch (err) {
      setError(err.response?.data?.room?.[0] || err.response?.data?.check_out?.[0] || err.response?.data?.guests?.[0] || 'Could not create this reservation.');
      setBooking(false);
    }
  };

  if (loading) return <CustomerLayout orgName={org?.name}><PageSpinner label="Loading room..." /></CustomerLayout>;
  if (!room) return <CustomerLayout orgName={org?.name}><p className="text-slate-500 dark:text-slate-400 text-center py-12">Room not found.</p></CustomerLayout>;

  if (success) {
    return (
      <CustomerLayout orgName={org?.name}>
        <Card className="p-8 text-center max-w-md mx-auto">
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Booking Confirmed!</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-5">{room.name} · {dates.checkIn} to {dates.checkOut}</p>
          <button onClick={() => navigate(`/book/${orgId}/my-bookings`)} className="px-5 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-sm font-semibold rounded-lg">View My Bookings</button>
        </Card>
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout orgName={org?.name}>
      <button
        onClick={() => navigate(`/book/${orgId}/properties/${propertyId}`)}
        className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Back to rooms
      </button>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ImageGallery images={room.images} alt={room.name} />
          <div className="mt-4">
            <div className="flex items-start justify-between gap-2">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{room.name}</h1>
              <Badge tone="blue">{ROOM_TYPE_LABELS[room.room_type] || room.room_type}</Badge>
            </div>
            <p className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 mt-1"><UsersIcon className="w-4 h-4" /> Sleeps {room.capacity}</p>
            {room.description && <p className="text-slate-600 dark:text-slate-300 mt-4">{room.description}</p>}
            {room.amenities?.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Amenities</h3>
                <div className="flex flex-wrap gap-1.5">
                  {room.amenities.map(a => <Badge key={a} tone="slate">{a}</Badge>)}
                </div>
              </div>
            )}
          </div>
        </div>

        <div>
          <Card className="p-5 sticky top-6">
            <PriceTag amount={room.price_per_night} suffix="/ night" className="text-xl font-bold text-slate-900 dark:text-white" />
            {error && (
              <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-600 dark:text-red-400 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> {error}
              </div>
            )}
            {paymentPending && (
              <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-600 dark:text-amber-400 text-xs">
                Your reservation is saved (pending payment). Online payment isn't available for this property yet — check My Bookings or contact them directly.
              </div>
            )}
            <div className="mt-4 space-y-4">
              <DateRangePicker checkIn={dates.checkIn} checkOut={dates.checkOut} onChange={setDates} />
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Guests</label>
                <input
                  type="number" min="1" max={room.capacity} value={guests}
                  onChange={e => setGuests(Math.min(room.capacity, Math.max(1, Number(e.target.value))))}
                  className="w-full px-3 py-2.5 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Special requests (optional)</label>
                <textarea rows={2} value={specialRequests} onChange={e => setSpecialRequests(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              {nights > 0 && (
                <div className="flex items-center justify-between text-sm border-t border-slate-200 dark:border-slate-700 pt-3">
                  <span className="text-slate-500 dark:text-slate-400">{nights} night{nights !== 1 ? 's' : ''}</span>
                  <PriceTag amount={total} className="font-semibold text-slate-900 dark:text-white" />
                </div>
              )}
              <button
                onClick={handleBook} disabled={booking || nights === 0}
                className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {booking ? <><Loader2 className="w-4 h-4 animate-spin" />Processing...</> : 'Book & Pay Now'}
              </button>
            </div>
          </Card>
        </div>
      </div>
    </CustomerLayout>
  );
};

export default RoomDetail;
