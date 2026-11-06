import api from './httpClient';

export const bookingAPI = {
  // Customer self-registration for a specific org's booking site (AllowAny on the backend)
  registerCustomer: (data) => api.post('/bookings/customers/register/', data),
  // Public booking-site browsing (no login): rooms with availability for ?check_in&check_out&guests&property
  getPublicProperties: (orgId) => api.get(`/bookings/public/${orgId}/properties/`),
  getPublicRooms: (orgId, params) => api.get(`/bookings/public/${orgId}/rooms/`, { params }),
  getPublicRoom: (orgId, roomId, params) => api.get(`/bookings/public/${orgId}/rooms/${roomId}/`, { params }),
  // Settings → Booking Site (staff read, STP admin write)
  getBookingSettings: () => api.get('/bookings/settings/'),
  updateBookingSettings: (data) => api.patch('/bookings/settings/', data),
  // Public lookup — {id, name, org_type} for an active ROOM_BOOKING STP org, no auth required
  getPublicOrgInfo: (orgId) => api.get(`/tenants/organizations/${orgId}/public_info/`),
  // Public list — every active ROOM_BOOKING STP org, for the shared /book landing page's org picker
  getPublicOrgList: () => api.get('/tenants/organizations/public_list/'),

  // Properties (buildings)
  getProperties: () => api.get('/bookings/properties/'),
  getProperty: (id) => api.get(`/bookings/properties/${id}/`),
  createProperty: (data) => api.post('/bookings/properties/', data),
  updateProperty: (id, data) => api.patch(`/bookings/properties/${id}/`, data),
  deleteProperty: (id) => api.delete(`/bookings/properties/${id}/`),

  // Rooms
  getRooms: (params) => api.get('/bookings/rooms/', { params }),
  getRoom: (id) => api.get(`/bookings/rooms/${id}/`),
  createRoom: (data) => api.post('/bookings/rooms/', data),
  updateRoom: (id, data) => api.patch(`/bookings/rooms/${id}/`, data),
  deleteRoom: (id) => api.delete(`/bookings/rooms/${id}/`),
  uploadRoomImage: (id, file, isPrimary = false) => {
    const form = new FormData();
    form.append('file', file);
    if (isPrimary) form.append('is_primary', 'true');
    return api.post(`/bookings/rooms/${id}/images/`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  deleteRoomImage: (roomId, imageId) => api.delete(`/bookings/rooms/${roomId}/images/${imageId}/`),

  // Reservations
  getBookings: (params) => api.get('/bookings/reservations/', { params }),
  // Booking confirmation PDF (guest or staff)
  downloadVoucher: (id) => api.get(`/bookings/reservations/${id}/voucher/`, { responseType: 'blob' }),
  // Desk payments & daily collection (staff)
  recordPayment: (id, data) => api.post(`/bookings/reservations/${id}/record_payment/`, data),
  getCollections: (date) => api.get('/bookings/collections/', { params: date ? { date } : undefined }),
  // Reviews
  submitReview: (id, data) => api.post(`/bookings/reservations/${id}/review/`, data),
  getStaffReviews: (params) => api.get('/bookings/reviews/', { params }),
  replyToReview: (reviewId, reply) => api.post(`/bookings/reviews/${reviewId}/reply/`, { reply }),
  getPublicReviews: (orgId) => api.get(`/bookings/public/${orgId}/reviews/`),
  // Staff: guests who booked with this property (?search=)
  getGuests: (params) => api.get('/bookings/guests/', { params }),
  getBooking: (id) => api.get(`/bookings/reservations/${id}/`),
  createBooking: (data) => api.post('/bookings/reservations/', data),
  createOrder: (id) => api.post(`/bookings/reservations/${id}/create_order/`),
  verifyPayment: (id, data) => api.post(`/bookings/reservations/${id}/verify_payment/`, data),
  cancelBooking: (id) => api.post(`/bookings/reservations/${id}/cancel/`),
  confirmBooking: (id) => api.post(`/bookings/reservations/${id}/confirm/`),
  checkInBooking: (id) => api.post(`/bookings/reservations/${id}/check_in/`),
  checkOutBooking: (id) => api.post(`/bookings/reservations/${id}/check_out/`),
  refundBooking: (id) => api.post(`/bookings/reservations/${id}/refund/`),
  getBookingHistory: (id) => api.get(`/bookings/reservations/${id}/history/`),
};
