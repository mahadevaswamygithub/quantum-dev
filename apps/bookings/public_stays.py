"""Public list of properties taking bookings - shared by the /book site's
API (OrganizationViewSet.public_list) and the guest assistant."""
from collections import Counter

from django.db.models import Count, Max, Min, Q

from apps.tenants.models import Organization

from .models import Booking, BookingSettings, Room, RoomImage
from .razorpay_client import get_client
from .services import pending_cutoff


def _rating_summary(org_ids):
    """{org_id: {'rating_avg': 4.3, 'rating_count': 12}}."""
    from django.db.models import Avg
    from .models import Review
    rows = Review.objects.filter(organization_id__in=org_ids).values('organization_id').annotate(avg=Avg('rating'), n=Count('id'))
    return {r['organization_id']: {'rating_avg': round(r['avg'], 1), 'rating_count': r['n']} for r in rows}


def public_stays(build_url, check_in=None, check_out=None, guests=None):
    """Active ROOM_BOOKING STP orgs with at least one bookable room, with
    only public-facing details. With check_in/check_out each entry gets
    `available_rooms` (rooms free for that stay, big enough for `guests`).
    `build_url` turns a media path into an absolute URL."""

    # Approved, switched-on accounts only (pending/suspended customers are hidden).
    orgs = list(Organization.objects.bookable().order_by('name'))
    ids = [o.id for o in orgs]
    active_rooms = (Room.objects.filter(organization_id__in=ids, is_active=True)
                    .filter(Q(property__isnull=True) | Q(property__is_active=True)))
    room_stats = {
        r['organization_id']: r
        for r in active_rooms.values('organization_id').annotate(
            n=Count('id'), min_price=Min('price_per_night'), max_capacity=Max('capacity'))
    }
    # One cover photo per org: a primary room image if there is one.
    covers = {}
    for img in RoomImage.objects.filter(room__in=active_rooms).select_related('room').order_by('-is_primary', 'order', 'id'):
        covers.setdefault(img.room.organization_id, img)
    # Most common amenities across an org's rooms (free text, so normalise case/spacing).
    amenity_counts, amenity_label = {}, {}
    for org_id, amenities in active_rooms.values_list('organization_id', 'amenities'):
        counter = amenity_counts.setdefault(org_id, Counter())
        for a in amenities or []:
            if isinstance(a, str) and a.strip():
                key = ' '.join(a.split()).lower()
                amenity_label.setdefault(key, ' '.join(a.split()))  # first spelling seen
                counter[key] += 1
    rules = {r.organization_id: r for r in BookingSettings.objects.filter(organization_id__in=ids)}
    ratings = _rating_summary(ids)
    online_payments = get_client() is not None

    # Live availability for a requested stay, in two queries.
    available = None
    if check_in and check_out:
        candidates = active_rooms.filter(capacity__gte=guests) if guests else active_rooms
        blocked = set(Booking.objects.filter(room__in=candidates).filter(
            Q(status__in=['CONFIRMED', 'CHECKED_IN'])
            | Q(status='PENDING', payment_method='AT_PROPERTY')
            | Q(status='PENDING', created_at__gte=pending_cutoff())
        ).filter(check_in__lt=check_out, check_out__gt=check_in).values_list('room_id', flat=True))
        available = Counter(org_id for room_id, org_id in candidates.values_list('id', 'organization_id')
                            if room_id not in blocked)

    def url(f):
        return build_url(f.url) if f else None

    def info(o):
        rule = rules.get(o.id)
        data = {
            'id': o.id, 'name': o.name, 'org_type': o.org_type,
            'logo': url(o.logo),
            'address': o.address,
            'cover_image': url(o.cover_image) or (url(covers[o.id].image) if o.id in covers else None),
            'room_count': room_stats[o.id]['n'],
            'min_price': room_stats[o.id]['min_price'],
            'max_capacity': room_stats[o.id]['max_capacity'],
            'amenities': [amenity_label[a] for a, _ in amenity_counts.get(o.id, Counter()).most_common(8)],
            'accepting_bookings': rule.accepting_bookings if rule else True,
            'auto_confirm': rule.auto_confirm if rule else True,
            'free_cancellation_hours': rule.free_cancellation_hours if rule else 24,
            'online_payments': online_payments,
            **ratings.get(o.id, {'rating_avg': None, 'rating_count': 0}),
        }
        if available is not None:
            data['available_rooms'] = available.get(o.id, 0)
        return data

    # A property with no bookable rooms isn't worth listing yet.
    return [info(o) for o in orgs if o.id in room_stats]
