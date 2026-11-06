"""
Room-booking vertical: only meaningful for STP organizations whose
org_type is ROOM_BOOKING (apps.tenants.models.Organization.ORG_TYPE_CHOICES),
enforced at the serializer layer rather than here — these models don't
themselves check org_type so they stay reusable if a future vertical wants
a similar room/reservation shape.
"""
import datetime

from django.db import models


class Property(models.Model):
    """One physical building/branch belonging to an org — e.g. a temple
    trust's separate guest-house blocks. Sits between Organization and Room
    (Organization → Property → Room → Booking). Same lat/lng field shape as
    Organization so RoundedCoordinatesMixin (apps.core.serializers) and the
    frontend's LocationField.jsx work unchanged for a property's address."""
    organization = models.ForeignKey('tenants.Organization', on_delete=models.CASCADE, related_name='properties')
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    address = models.CharField(max_length=255, blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'booking_properties'
        ordering = ['name']
        verbose_name_plural = 'properties'
        indexes = [
            models.Index(fields=['organization', 'is_active']),
        ]

    def __str__(self):
        return f"{self.name} — {self.organization.name}"


class Room(models.Model):
    ROOM_TYPE_CHOICES = [
        ('SINGLE', 'Single Room'),
        ('DOUBLE', 'Double Room'),
        ('SUITE', 'Suite'),
        ('DELUXE', 'Deluxe Room'),
        ('CONFERENCE', 'Conference Room'),
        ('OTHER', 'Other'),
    ]

    organization = models.ForeignKey('tenants.Organization', on_delete=models.CASCADE, related_name='rooms')
    # Nullable at the DB level (safe migration regardless of any rooms that
    # already exist), required at the serializer layer instead — same
    # precedent as Organization.org_type (nullable model field, enforced
    # "required for STP" only in OrganizationCreateSerializer.validate()).
    property = models.ForeignKey(Property, on_delete=models.CASCADE, related_name='rooms', null=True, blank=True)
    name = models.CharField(max_length=100)
    room_type = models.CharField(max_length=15, choices=ROOM_TYPE_CHOICES, default='OTHER')
    description = models.TextField(blank=True)
    capacity = models.PositiveIntegerField(default=1)
    price_per_night = models.DecimalField(max_digits=10, decimal_places=2)
    amenities = models.JSONField(default=list, blank=True)  # e.g. ["WiFi", "AC", "TV"]
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'booking_rooms'
        ordering = ['name']
        indexes = [
            models.Index(fields=['organization', 'property']),
            models.Index(fields=['property', 'is_active']),
            models.Index(fields=['room_type', 'is_active']),
        ]

    def __str__(self):
        return f"{self.name} — {self.organization.name}"


class RoomImage(models.Model):
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='images')
    image = models.ImageField(upload_to='room_images/')
    is_primary = models.BooleanField(default=False)
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'booking_room_images'
        ordering = ['order', 'id']

    def __str__(self):
        return f"Image for {self.room.name}"


class Booking(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'Pending Payment'),
        ('CONFIRMED', 'Confirmed'),
        ('CHECKED_IN', 'Checked In'),
        ('CHECKED_OUT', 'Checked Out'),
        ('CANCELLED', 'Cancelled'),
    ]

    # Denormalized alongside `room.organization`/`room.property` — same
    # pattern as ActivityLog.organization — so OrganizationScopedQuerysetMixin
    # applies directly, and staff can filter/see bookings by building
    # without a join at every call site.
    organization = models.ForeignKey('tenants.Organization', on_delete=models.CASCADE, related_name='bookings')
    property = models.ForeignKey(Property, on_delete=models.CASCADE, related_name='bookings', null=True, blank=True)
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='bookings')
    # PROTECT: a guest deleting their account anonymizes it rather than
    # removing the row, so the property's reservation records survive.
    customer = models.ForeignKey('users.User', on_delete=models.PROTECT, related_name='bookings')
    # Snapshot of the guest's contact details when they booked — the property's
    # record of the reservation, unaffected by later profile edits or deletion.
    guest_name = models.CharField(max_length=150, blank=True)
    guest_email = models.EmailField(blank=True)
    guest_phone = models.CharField(max_length=20, blank=True)
    check_in = models.DateField()
    check_out = models.DateField()
    guests = models.PositiveIntegerField(default=1)
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='PENDING')
    PAYMENT_METHOD_CHOICES = [
        ('ONLINE', 'Pay online'),
        ('AT_PROPERTY', 'Pay at property'),
    ]
    # ONLINE: a PENDING booking holds the room only for the payment window.
    # AT_PROPERTY (used when online payment isn't set up): it holds the room
    # until staff confirm or cancel it.
    payment_method = models.CharField(max_length=12, choices=PAYMENT_METHOD_CHOICES, default='ONLINE')
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    special_requests = models.TextField(blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    CANCEL_REASON_CHOICES = [
        ('EXPIRED', 'Payment window expired'),
        ('CUSTOMER', 'Cancelled by customer'),
        ('STAFF', 'Cancelled by staff'),
        ('REFUNDED', 'Refunded'),
        ('UNAVAILABLE', 'Room no longer available'),
    ]
    # Why a CANCELLED booking was cancelled. Only an EXPIRED one may be
    # revived, when a late payment arrives and the room is still free.
    cancel_reason = models.CharField(max_length=12, choices=CANCEL_REASON_CHOICES, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'booking_reservations'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['organization', 'status']),
            models.Index(fields=['room', 'check_in', 'check_out']),
            models.Index(fields=['customer', 'status']),
        ]

    def __str__(self):
        return f"{self.customer.get_full_name()} — {self.room.name} ({self.check_in} to {self.check_out})"

    @staticmethod
    def room_is_available(room, check_in, check_out, exclude_booking_id=None):
        """
        True if no other active booking on this room overlaps the given
        date range. An unpaid ONLINE booking holds the room only for its
        payment window (settings.BOOKING_PAYMENT_WINDOW_MINUTES); after that
        it no longer blocks anyone, whether or not the expiry job has
        flipped it to CANCELLED yet. An AT_PROPERTY booking holds it until
        staff confirm or cancel it. Standard interval-overlap test: two
        ranges overlap unless one ends before the other starts.
        """
        return not Booking.blocking_bookings(room, check_in, check_out, exclude_booking_id).exists()

    @staticmethod
    def blocking_bookings(room, check_in, check_out, exclude_booking_id=None):
        """The bookings that currently hold `room` for any night in the range."""
        from django.db.models import Q
        from .services import pending_cutoff
        qs = Booking.objects.filter(room=room).filter(
            Q(status__in=['CONFIRMED', 'CHECKED_IN'])
            | Q(status='PENDING', payment_method='AT_PROPERTY')
            | Q(status='PENDING', created_at__gte=pending_cutoff())
        ).filter(check_in__lt=check_out, check_out__gt=check_in)
        if exclude_booking_id:
            qs = qs.exclude(id=exclude_booking_id)
        return qs


class Payment(models.Model):
    STATUS_CHOICES = [
        ('CREATED', 'Created'),
        ('PAID', 'Paid'),
        ('FAILED', 'Failed'),
        ('REFUNDED', 'Refunded'),
    ]

    # FK (not OneToOne) — a failed/abandoned Razorpay order shouldn't block
    # the guest from retrying create_order on the same booking.
    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name='payments')
    razorpay_order_id = models.CharField(max_length=100, blank=True, db_index=True)
    razorpay_payment_id = models.CharField(max_length=100, blank=True)
    razorpay_signature = models.CharField(max_length=255, blank=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=5, default='INR')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='CREATED')
    METHOD_CHOICES = [
        ('ONLINE', 'Online (Razorpay)'),
        ('CASH', 'Cash'),
        ('UPI', 'UPI'),
        ('CARD', 'Card'),
        ('OTHER', 'Other'),
    ]
    # ONLINE payments come through Razorpay; the rest are recorded by staff
    # at the desk (apps.bookings.views.BookingViewSet.record_payment).
    method = models.CharField(max_length=10, choices=METHOD_CHOICES, default='ONLINE')
    collected_by = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True, blank=True,
                                     related_name='collected_payments')
    note = models.CharField(max_length=200, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)  # when the money was received
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'booking_payments'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['booking', 'status']),
            models.Index(fields=['status', 'paid_at']),
        ]

    def __str__(self):
        return f"Payment {self.razorpay_payment_id or self.razorpay_order_id or self.id} — {self.status}"


class BookingSettings(models.Model):
    """Per-organization booking-site rules, edited from Settings → Booking
    Site. Created on first read with these defaults (see BookingSettingsView)."""
    organization = models.OneToOneField(
        'tenants.Organization', on_delete=models.CASCADE, related_name='booking_settings',
    )
    accepting_bookings = models.BooleanField(
        default=True,
        help_text='When off, customers can still browse but new reservations are refused.',
    )
    auto_confirm = models.BooleanField(
        default=True,
        help_text='Confirm new bookings immediately instead of waiting for staff approval.',
    )
    free_cancellation_hours = models.PositiveIntegerField(
        default=24,
        help_text='Guests can cancel online until this many hours before check-in (0 = until check-in time).',
    )
    check_in_time = models.TimeField(default=datetime.time(14, 0))
    check_out_time = models.TimeField(default=datetime.time(11, 0))
    cancellation_policy = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'booking_settings'
        verbose_name_plural = 'booking settings'

    def __str__(self):
        return f"Booking settings — {self.organization.name}"

    @classmethod
    def for_org(cls, organization):
        obj, _ = cls.objects.get_or_create(organization=organization)
        return obj


class Review(models.Model):
    """A guest's rating of a completed stay — one per booking. `comment` and
    the property's `reply` are public; `private_feedback` is seen only by
    the property's staff."""
    booking = models.OneToOneField(Booking, on_delete=models.CASCADE, related_name='review')
    organization = models.ForeignKey('tenants.Organization', on_delete=models.CASCADE, related_name='reviews')
    customer = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='reviews')
    rating = models.PositiveSmallIntegerField()  # 1–5
    comment = models.TextField(blank=True)
    private_feedback = models.TextField(blank=True)
    reply = models.TextField(blank=True)
    replied_by = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='review_replies')
    replied_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'booking_reviews'
        ordering = ['-created_at']
        indexes = [models.Index(fields=['organization', '-created_at'])]

    def __str__(self):
        return f"{self.rating}★ — {self.organization.name}"
