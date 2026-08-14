from django.utils import timezone
from rest_framework import serializers

from apps.core.serializers import RoundedCoordinatesMixin
from apps.tenants.models import Organization
from apps.users.models import User
from .models import Property, Room, RoomImage, Booking, Payment


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
        # Same reasoning as RoomSerializer.validate() below — organization
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
        # own org) rather than accepted from the client — see
        # RoomViewSet.perform_create — but on update we still need to
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
    """Nested room summary for the reservation list — avoids the frontend
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
    customer_name = serializers.CharField(source='customer.get_full_name', read_only=True)
    customer_email = serializers.CharField(source='customer.email', read_only=True)
    nights = serializers.SerializerMethodField()
    payment_status = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = [
            'id', 'organization', 'property', 'property_name', 'room', 'room_detail',
            'customer', 'customer_name', 'customer_email',
            'check_in', 'check_out', 'nights', 'guests', 'status', 'total_amount',
            'special_requests', 'payment_status', 'cancelled_at', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'organization', 'property', 'customer', 'status', 'total_amount', 'cancelled_at', 'created_at', 'updated_at']

    def get_nights(self, obj):
        return (obj.check_out - obj.check_in).days

    def get_payment_status(self, obj):
        payment = obj.payments.order_by('-created_at').first()
        return payment.status if payment else None


class BookingCreateSerializer(serializers.ModelSerializer):
    """What a CUSTOMER submits to create a reservation — everything else
    (organization, customer, status, total_amount) is derived server-side
    in BookingViewSet.perform_create, never trusted from the client."""

    class Meta:
        model = Booking
        fields = ['room', 'check_in', 'check_out', 'guests', 'special_requests']

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
        if not Booking.room_is_available(room, check_in, check_out):
            raise serializers.ValidationError({'room': 'This room is already booked for the selected dates.'})
        return data


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = ['id', 'booking', 'amount', 'currency', 'status', 'razorpay_order_id', 'razorpay_payment_id', 'created_at']
        read_only_fields = fields


class CustomerRegisterSerializer(serializers.ModelSerializer):
    """Self-service sign-up for a specific ROOM_BOOKING STP org's
    customers — a real password set by the customer themself, unlike
    UserCreateSerializer's staff-invite flow (unusable password + emailed
    set-password link). Intentionally a separate serializer/endpoint so
    the two account-creation paths never cross."""
    organization_id = serializers.IntegerField(write_only=True)
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ['username', 'email', 'first_name', 'last_name', 'password', 'organization_id']

    def validate_organization_id(self, value):
        try:
            org = Organization.objects.get(id=value)
        except Organization.DoesNotExist:
            raise serializers.ValidationError('Organization not found.')
        if org.tenant_type != 'STP' or org.org_type != 'ROOM_BOOKING' or not org.is_active:
            raise serializers.ValidationError('This organization is not accepting bookings.')
        return value

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError('An account with this email already exists.')
        return value

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError('Username already taken.')
        return value

    def create(self, validated_data):
        org_id = validated_data.pop('organization_id')
        password = validated_data.pop('password')
        user = User(organization_id=org_id, role='CUSTOMER', **validated_data)
        user.set_password(password)
        user.save()
        return user
