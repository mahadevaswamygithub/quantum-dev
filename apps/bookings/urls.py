"""Room-booking vertical — mounted at /api/bookings/.

/api/bookings/customers/register/            POST  (AllowAny) self-service customer sign-up
/api/bookings/settings/                      GET (staff), PATCH/PUT (STP admin)
/api/bookings/guests/                        GET (staff) guests who booked with this property (?search=)
/api/bookings/collections/                   GET (payments.report) daily collection (?date=YYYY-MM-DD)
/api/bookings/reviews/                       GET (reviews.view) this property's reviews
/api/bookings/reviews/<id>/reply/            POST (reviews.reply) public reply
/api/bookings/public/<org_id>/reviews/       GET (AllowAny) recent public reviews
/api/bookings/reservations/<id>/record_payment/  POST (payments.collect) cash/UPI/card at the desk
/api/bookings/reservations/<id>/review/         POST (guest, after check-out)
/api/bookings/reservations/<id>/voucher/        GET  booking confirmation PDF (guest or staff)
/api/bookings/razorpay/webhook/              POST  (Razorpay, HMAC-signed) payment notifications
/api/bookings/public/<org_id>/properties/    GET   (AllowAny) booking-site browsing
/api/bookings/public/<org_id>/rooms/         GET   (AllowAny) ?check_in&check_out&guests&property
/api/bookings/public/<org_id>/rooms/<id>/    GET   (AllowAny)
/api/bookings/properties/                    GET, POST
/api/bookings/properties/<id>/               GET, PUT, PATCH, DELETE
/api/bookings/rooms/                         GET, POST  (?property=<id> to filter by building)
/api/bookings/rooms/<id>/                    GET, PUT, PATCH, DELETE
/api/bookings/rooms/<id>/images/             POST
/api/bookings/rooms/<id>/images/<image_id>/  DELETE
/api/bookings/reservations/                  GET, POST
/api/bookings/reservations/<id>/             GET
/api/bookings/reservations/<id>/create_order/    POST  (customer)
/api/bookings/reservations/<id>/verify_payment/  POST  (customer)
/api/bookings/reservations/<id>/cancel/          POST  (customer or staff)
/api/bookings/reservations/<id>/confirm/         POST  (staff)
/api/bookings/reservations/<id>/check_in/        POST  (staff)
/api/bookings/reservations/<id>/check_out/       POST  (staff)
/api/bookings/reservations/<id>/refund/          POST  (staff)
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    PropertyViewSet, RoomViewSet, BookingViewSet, CustomerRegisterView, BookingSettingsView,
    RazorpayWebhookView, PublicPropertyListView, PublicRoomListView, GuestListView,
    CollectionReportView, StaffReviewListView, StaffReviewReplyView, PublicReviewListView,
)


router = DefaultRouter()
router.register(r'properties', PropertyViewSet, basename='property')
router.register(r'rooms', RoomViewSet, basename='room')
router.register(r'reservations', BookingViewSet, basename='reservation')

urlpatterns = [
    path('customers/register/', CustomerRegisterView.as_view(), name='customer-register'),
    path('settings/', BookingSettingsView.as_view(), name='booking-settings'),
    path('guests/', GuestListView.as_view(), name='booking-guests'),
    path('collections/', CollectionReportView.as_view(), name='booking-collections'),
    path('reviews/', StaffReviewListView.as_view(), name='booking-reviews'),
    path('reviews/<int:review_id>/reply/', StaffReviewReplyView.as_view(), name='booking-review-reply'),
    path('public/<int:org_id>/reviews/', PublicReviewListView.as_view(), name='public-reviews'),
    path('razorpay/webhook/', RazorpayWebhookView.as_view(), name='razorpay-webhook'),
    path('public/<int:org_id>/properties/', PublicPropertyListView.as_view(), name='public-properties'),
    path('public/<int:org_id>/rooms/', PublicRoomListView.as_view(), name='public-rooms'),
    path('public/<int:org_id>/rooms/<int:room_id>/', PublicRoomListView.as_view(), name='public-room-detail'),
    path('', include(router.urls)),
]
