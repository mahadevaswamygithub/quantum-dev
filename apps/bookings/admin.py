from django.contrib import admin
from .models import Property, Room, RoomImage, Booking, Payment


@admin.register(Property)
class PropertyAdmin(admin.ModelAdmin):
    list_display = ['name', 'organization', 'address', 'is_active']
    list_filter = ['is_active', 'organization']
    search_fields = ['name', 'organization__name', 'address']


class RoomImageInline(admin.TabularInline):
    model = RoomImage
    extra = 0


@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ['name', 'organization', 'property', 'room_type', 'price_per_night', 'capacity', 'is_active']
    list_filter = ['room_type', 'is_active', 'organization']
    search_fields = ['name', 'organization__name']
    inlines = [RoomImageInline]


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ['id', 'customer', 'room', 'check_in', 'check_out', 'status', 'total_amount']
    list_filter = ['status', 'organization']
    search_fields = ['customer__email', 'customer__username', 'room__name']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ['id', 'booking', 'amount', 'status', 'razorpay_payment_id', 'created_at']
    list_filter = ['status']
    search_fields = ['razorpay_order_id', 'razorpay_payment_id']
    readonly_fields = ['created_at', 'updated_at']
