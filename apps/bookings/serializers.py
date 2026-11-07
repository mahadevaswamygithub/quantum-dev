from django.utils import timezone
from rest_framework import serializers

from apps.core.serializers import RoundedCoordinatesMixin
from apps.tenants.models import Organization
from apps.users.models import User
from .models import Property, Room, RoomImage, Booking, BookingSettings, Payment, Review


class PropertySerializer(RoundedCoordinatesMixin, serializers.ModelSerializer):
    organization_name = serializers.CharField(source='organization.name', read_only=True)
    room_count = serializers.IntegerField(source='rooms.count', read_only=True)

    class Meta:
        model = Property
        fields = [
            'id', 'organization', 'organization_name', 'name', 'description',
            'address', 'latitude', 'longitude', 'is_active', 'room_count',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'organization', 'created_at', 'updated_at']

    def validate(self, data):
        # Same reasoning as RoomSerializer.validate() below - organization
        # is set server-side by the view, this just defends against it
        # somehow not being a ROOM_BOOKING org.
        org = self.instance.organization if self.instance else self.context.get('organization')
        if org and org.org_type != 'ROOM_BOOKING':
            raise serializers.ValidationError("Properties can only belong to a Room Booking organization.")
        return data


class RoomImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = RoomImage
        fields = ['id', 'image', 'is_primary', 'order']
        read_only_fields = ['id']


class RoomSerializer(serializers.ModelSerializer):
    images = RoomImageSerializer(many=True, read_only=True)
    organization_name = serializers.CharField(source='organization.name', read_only=True)
    property_name = serializers.CharField(source='property.name', read_only=True)

    class Meta:
        model = Room
        fields = [
            'id', 'organization', 'organization_name', 'property', 'property_name',
            'name', 'room_type', 'description', 'capacity', 'price_per_night', 'amenities',
            'is_active', 'images', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'organization', 'created_at', 'updated_at']
        extra_kwargs = {'property': {'required': True}}

    def validate(self, data):
        # organization is set explicitly by the view (the staff member's
        # own org) rather than accepted from the client - see
        # RoomViewSet.perform_create - but on update we still need to
        # reject the request if the org somehow isn't a room-booking STP
        # org (defensive; the view already only lets ROOM_BOOKING-org staff
        # reach this serializer at all).
        org = self.instance.organization if self.instance else self.context.get('organization')
        if org and org.org_type != 'ROOM_BOOKING':
            raise serializers.ValidationError("Rooms can only belong to a Room Booking organization.")

        room_property = data.get('property', getattr(self.instance, 'property', None))
        if room_property and org and room_property.organization_id != org.id:
            raise serializers.ValidationError({'property': "This property doesn't belong to your organization."})
        return data


class BookingRoomBriefSerializer(serializers.ModelSerializer):
    """Nested room summary for the reservation list - avoids the frontend
    needing a second request per booking just to show what was booked."""
    primary_image = serializers.SerializerMethodField()

    class Meta:
        model = Room
        fields = ['id', 'name', 'room_type', 'price_per_night', 'primary_image']

    def get_primary_image(self, obj):
        img = obj.images.filter(is_primary=True).first() or obj.images.first()
        if not img:
            return None
        request = self.context.get('request')
        return request.build_absolute_uri(img.image.url) if request else img.image.url


class BookingSerializer(serializers.ModelSerializer):
    room_detail = BookingRoomBriefSerializer(source='room', read_only=True)
    property_name = serializers.CharField(source='property.name', read_only=True)
    # From the booking-time snapshot (falls back to the live account for
    # bookings made before snapshots existed).
    customer_name = serializers.SerializerMethodField()
    customer_email = serializers.SerializerMethodField()
    customer_phone = serializers.SerializerMethodField()
    # A guest's trips can span several properties - say which one.
    organization_name = serializers.CharField(source='organization.name', read_only=True)
    organization_phone = serializers.CharField(source='organization.contact_phone', read_only=True)
    organization_address = serializers.CharField(source='organization.address', read_only=True)
    check_in_time = serializers.SerializerMethodField()
    check_out_time = serializers.SerializerMethodField()
    cancellation_deadline = serializers.SerializerMethodField()
    can_cancel = serializers.SerializerMethodField()
    nights = serializers.SerializerMethodField()
    payment_status = serializers.SerializerMethodField()
    is_paid = serializers.SerializerMethodField()
    amount_paid = serializers.SerializerMethodField()
    balance_due = serializers.SerializerMethodField()
    can_pay_online = serializers.SerializerMethodField()
    review = serializers.SerializerMethodField()
    can_review = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = [
            'id', 'organization', 'organization_name', 'organization_phone', 'organization_address',
            'check_in_time', 'check_out_time', 'cancellation_deadline', 'can_cancel', 'property', 'property_name', 'room', 'room_detail',
            'customer', 'customer_name', 'customer_email', 'customer_phone',
            'check_in', 'check_out', 'nights', 'guests', 'status', 'total_amount',
            'special_requests', 'payment_status', 'is_paid', 'amount_paid', 'balance_due', 'can_pay_online',
            'review', 'can_review', 'payment_method', 'cancelled_at', 'cancel_reason',
            'cancel_request_status', 'cancel_request_reason', 'cancel_requested_at', 'cancel_request_reply',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'organization', 'property', 'customer', 'status', 'total_amount', 'payment_method', 'cancelled_at', 'cancel_reason',
                            'cancel_request_status', 'cancel_request_reason', 'cancel_requested_at', 'cancel_request_reply', 'created_at', 'updated_at']

    def get_nights(self, obj):
        return (obj.check_out - obj.check_in).days

    def get_customer_name(self, obj):
        return obj.guest_name or obj.customer.get_full_name()

    def get_customer_email(self, obj):
        return obj.guest_email or obj.customer.email

    def get_customer_phone(self, obj):
        return obj.guest_phone or (obj.customer.phone or '')

    def get_payment_status(self, obj):
        payment = obj.payments.order_by('-created_at').first()
        return payment.status if payment else None

    def _rules(self, obj):
        from .models import BookingSettings
        return getattr(obj.organization, 'booking_settings', None) or BookingSettings(organization=obj.organization)

    def get_check_in_time(self, obj):
        return self._rules(obj).check_in_time.strftime('%H:%M')

    def get_check_out_time(self, obj):
        return self._rules(obj).check_out_time.strftime('%H:%M')

    def get_cancellation_deadline(self, obj):
        from .services import cancellation_deadline
        return cancellation_deadline(obj).isoformat()

    def get_can_cancel(self, obj):
        """Whether the *requesting guest* may cancel online right now."""
        from .services import guest_can_cancel
        return guest_can_cancel(obj)

    def get_is_paid(self, obj):
        from .services import balance_due
        return any(p.status == 'PAID' for p in obj.payments.all()) and balance_due(obj) <= 0

    def get_amount_paid(self, obj):
        from .services import amount_paid
        return str(amount_paid(obj))

    def get_balance_due(self, obj):
        from .services import balance_due
        return str(balance_due(obj))

    def _review(self, obj):
        try:
            return obj.review
        except Review.DoesNotExist:
            return None

    def get_review(self, obj):
        r = self._review(obj)
        return {'id': r.id, 'rating': r.rating, 'comment': r.comment, 'reply': r.reply} if r else None

    def get_can_review(self, obj):
        request = self.context.get('request')
        return (obj.status == 'CHECKED_OUT' and self._review(obj) is None and request is not None
                and request.user.id == obj.customer_id)

    def get_can_pay_online(self, obj):
        from .services import can_pay_online
        return can_pay_online(obj)


class BookingCreateSerializer(serializers.ModelSerializer):
    """What a CUSTOMER submits to create a reservation - everything else
    (organization, customer, status, total_amount) is derived server-side
    in BookingViewSet.perform_create, never trusted from the client."""

    class Meta:
        model = Booking
        fields = ['room', 'check_in', 'check_out', 'guests', 'special_requests']

    def validate_room(self, room):
        # Guest accounts are platform-wide: one account can book at any
        # property. The booking is attributed to the room's organization
        # (see BookingViewSet.create), so only that org's staff see it.
        # The org must still be an active Room Booking property.
        org = room.organization
        if not org.is_active or org.tenant_type != 'STP' or org.org_type != 'ROOM_BOOKING':
            raise serializers.ValidationError('This room is not available for booking.')
        return room

    def validate(self, data):
        room = data['room']
        check_in, check_out = data['check_in'], data['check_out']
        if check_out <= check_in:
            raise serializers.ValidationError({'check_out': 'Check-out must be after check-in.'})
        if check_in < timezone.now().date():
            raise serializers.ValidationError({'check_in': 'Check-in cannot be in the past.'})
        if not room.is_active:
            raise serializers.ValidationError({'room': 'This room is not available for booking.'})
        if data.get('guests', 1) > room.capacity:
            raise serializers.ValidationError({'guests': f'This room sleeps at most {room.capacity} guest(s).'})
        request = self.context.get('request')
        blocking = Booking.blocking_bookings(room, check_in, check_out)
        if request is not None:
            blocking = blocking.exclude(customer=request.user)
        if blocking.exists():
            raise serializers.ValidationError({'room': 'This room is already booked for the selected dates.'})
        return data


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = ['id', 'booking', 'amount', 'currency', 'status', 'razorpay_order_id', 'razorpay_payment_id', 'created_at']
        read_only_fields = fields


class CustomerRegisterSerializer(serializers.ModelSerializer):
    """Self-service guest sign-up. The account works at every property;
    organization_id only records which property's site they signed up on
    (it's also where they appear in that org's user list). Guests - a real password set by the customer themself, unlike
    UserCreateSerializer's staff-invite flow (unusable password + emailed
    set-password link). Intentionally a separate serializer/endpoint so
    the two account-creation paths never cross."""
    # Optional: which property's site they signed up on (None from /book/register).
    organization_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ['username', 'email', 'first_name', 'last_name', 'phone', 'password', 'organization_id']
        extra_kwargs = {'phone': {'required': False}}

    def validate_organization_id(self, value):
        if value is None:
            return None
        if not Organization.objects.filter(id=value).exists():
            raise serializers.ValidationError('Organization not found.')
        if not Organization.objects.bookable().filter(id=value).exists():
            raise serializers.ValidationError('This organization is not accepting bookings.')
        return value

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('An account with this email already exists.')
        return value

    def validate(self, data):
        from apps.core.login_guard import password_problems
        problems = password_problems(data.get('password'), User(email=data.get('email', ''), username=data.get('username', ''),
                                                                first_name=data.get('first_name', ''), last_name=data.get('last_name', '')))
        if problems:
            raise serializers.ValidationError({'password': problems})
        return data

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError('Username already taken.')
        return value

    def create(self, validated_data):
        # Accepted for backwards compatibility but not stored: a guest
        # account belongs to the platform, not to the property whose site
        # they happened to sign up on (see GuestListView for what staff see).
        validated_data.pop('organization_id', None)
        password = validated_data.pop('password')
        user = User(organization=None, role='CUSTOMER', **validated_data)
        user.set_password(password)
        user.save()
        return user


class BookingSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = BookingSettings
        fields = ['accepting_bookings', 'auto_confirm', 'free_cancellation_hours', 'check_in_time', 'check_out_time', 'cancellation_policy', 'updated_at']
        read_only_fields = ['updated_at']

    def validate(self, data):
        check_in = data.get('check_in_time', getattr(self.instance, 'check_in_time', None))
        check_out = data.get('check_out_time', getattr(self.instance, 'check_out_time', None))
        if check_in and check_out and check_out >= check_in:
            # Check-out is on the *next* day, so it should be earlier in the
            # day than check-in - otherwise a room can't be turned around.
            raise serializers.ValidationError(
                {'check_out_time': 'Check-out time should be earlier in the day than check-in time.'}
            )
        return data


class PublicRoomSerializer(serializers.ModelSerializer):
    """What an anonymous visitor of a booking site may see about a room -
    no organization internals. `available` is filled in by the view when
    the visitor has picked dates (None otherwise)."""
    images = RoomImageSerializer(many=True, read_only=True)
    property_name = serializers.CharField(source='property.name', read_only=True, default='')
    # The building's own public details, for the room page's "About the property".
    property_description = serializers.CharField(source='property.description', read_only=True, default='')
    property_address = serializers.CharField(source='property.address', read_only=True, default='')
    available = serializers.SerializerMethodField()

    class Meta:
        model = Room
        fields = [
            'id', 'name', 'room_type', 'description', 'capacity', 'price_per_night',
            'amenities', 'images', 'property', 'property_name', 'property_description', 'property_address', 'available',
        ]

    def get_available(self, obj):
        return self.context.get('availability', {}).get(obj.id)


class PublicPropertySerializer(serializers.ModelSerializer):
    room_count = serializers.SerializerMethodField()

    class Meta:
        model = Property
        fields = ['id', 'name', 'description', 'address', 'room_count']

    def get_room_count(self, obj):
        return sum(1 for r in obj.rooms.all() if r.is_active)


class ReviewCreateSerializer(serializers.Serializer):
    rating = serializers.IntegerField(min_value=1, max_value=5)
    comment = serializers.CharField(required=False, allow_blank=True, max_length=2000)
    private_feedback = serializers.CharField(required=False, allow_blank=True, max_length=2000)


def _guest_display_name(user):
    """'Kumar A.' - public reviews never show a full surname or email."""
    first = (user.first_name or 'Guest').strip()
    last = (user.last_name or '').strip()
    return f"{first} {last[0]}." if last and not user.email.endswith('@deleted.invalid') else first


class PublicReviewSerializer(serializers.ModelSerializer):
    guest = serializers.SerializerMethodField()
    room = serializers.CharField(source='booking.room.name', read_only=True)

    class Meta:
        model = Review
        fields = ['id', 'rating', 'comment', 'reply', 'replied_at', 'created_at', 'guest', 'room']

    def get_guest(self, obj):
        return _guest_display_name(obj.customer)


class StaffReviewSerializer(PublicReviewSerializer):
    """Staff also see the private note and which booking it was."""
    booking_id = serializers.IntegerField(source='booking.id', read_only=True)
    check_in = serializers.DateField(source='booking.check_in', read_only=True)
    check_out = serializers.DateField(source='booking.check_out', read_only=True)
    guest_email = serializers.CharField(source='booking.guest_email', read_only=True)
    replied_by_name = serializers.SerializerMethodField()

    class Meta(PublicReviewSerializer.Meta):
        fields = PublicReviewSerializer.Meta.fields + [
            'private_feedback', 'booking_id', 'check_in', 'check_out', 'guest_email', 'replied_by_name',
        ]

    def get_replied_by_name(self, obj):
        return obj.replied_by.get_full_name() if obj.replied_by else None

