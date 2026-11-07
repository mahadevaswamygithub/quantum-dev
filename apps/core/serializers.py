"""
Shared, cross-app DRF serializer mixins - the counterpart to
apps.core.permissions' shared queryset-scoping helpers.
"""
from decimal import Decimal, InvalidOperation


class RoundedCoordinatesMixin:
    """Rounds incoming latitude/longitude to 6 decimal places (the model
    field's precision, ~11cm - plenty for a dashboard pin) before DRF's own
    field parsing sees them. Geocoders like Nominatim commonly return 7+
    decimal places, which DecimalField(decimal_places=6) otherwise rejects
    outright with "Ensure that there are no more than 6 decimal places."
    Rounding here is a backend-side safety net so no future caller of this
    API (a different frontend flow, the admin, a script) can hit that error
    either - the frontend already rounds too, but that alone only protects
    the one form that does it.

    Originally lived on apps.tenants.serializers (Organization only); moved
    here once apps.bookings.Property needed the exact same lat/lng field
    shape - any future model with the same DecimalField(decimal_places=6)
    pair can reuse it from here."""

    def to_internal_value(self, data):
        data = data.copy() if hasattr(data, 'copy') else dict(data)
        for field in ('latitude', 'longitude'):
            value = data.get(field)
            if value in (None, ''):
                continue
            try:
                data[field] = str(Decimal(str(value)).quantize(Decimal('0.000001')))
            except (InvalidOperation, ValueError, TypeError):
                pass  # let the normal field validation surface the real error
        return super().to_internal_value(data)
