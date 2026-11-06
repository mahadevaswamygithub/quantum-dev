import { bookingAPI } from '../services/api';

/** Downloads a booking's confirmation PDF ("booking-CX-000014.pdf"). Throws on failure. */
export const downloadVoucher = async (bookingId) => {
  const { data } = await bookingAPI.downloadVoucher(bookingId);
  const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `booking-CX-${String(bookingId).padStart(6, '0')}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
