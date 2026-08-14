"""Room-booking vertical — mounted at /api/bookings/.

/api/bookings/customers/register/            POST  (AllowAny) self-service customer sign-up
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

from .views import PropertyViewSet, RoomViewSet, BookingViewSet, CustomerRegisterView

router = DefaultRouter()
router.register(r'properties', PropertyViewSet, basename='property')
router.register(r'rooms', RoomViewSet, basename='room')
router.register(r'reservations', BookingViewSet, basename='reservation')

urlpatterns = [
    path('customers/register/', CustomerRegisterView.as_view(), name='customer-register'),
    path('', include(router.urls)),
]
