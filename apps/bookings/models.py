"""
Room-booking vertical: only meaningful for STP organizations whose
org_type is ROOM_BOOKING (apps.tenants.models.Organization.ORG_TYPE_CHOICES),
enforced at the serializer layer rather than here — these models don't
themselves check org_type so they stay reusable if a future vertical wants
a similar room/reservation shape.
"""
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
    customer = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='bookings')
    check_in = models.DateField()
    check_out = models.DateField()
    guests = models.PositiveIntegerField(default=1)
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='PENDING')
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    special_requests = models.TextField(blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'booking_reservations'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.customer.get_full_name()} — {self.room.name} ({self.check_in} to {self.check_out})"

    @staticmethod
    def room_is_available(room, check_in, check_out, exclude_booking_id=None):
        """
        True if no other non-cancelled booking on this room overlaps the
        given date range. A PENDING (unpaid) booking still holds the room —
        it occupies the slot for the duration of its payment window, same
        as a real booking site — only CANCELLED bookings free it up.
        Standard interval-overlap test: two ranges overlap unless one ends
        before the other starts.
        """
        qs = Booking.objects.filter(
            room=room,
            status__in=['PENDING', 'CONFIRMED', 'CHECKED_IN'],
        ).filter(check_in__lt=check_out, check_out__gt=check_in)
        if exclude_booking_id:
            qs = qs.exclude(id=exclude_booking_id)
        return not qs.exists()


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
    razorpay_order_id = models.CharField(max_length=100, blank=True)
    razorpay_payment_id = models.CharField(max_length=100, blank=True)
    razorpay_signature = models.CharField(max_length=255, blank=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=5, default='INR')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='CREATED')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'booking_payments'
        ordering = ['-created_at']

    def __str__(self):
        return f"Payment {self.razorpay_payment_id or self.razorpay_order_id or self.id} — {self.status}"
