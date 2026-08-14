from django.core.validators import MinValueValidator, MaxValueValidator
from django.db import models
from django_tenants.models import TenantMixin, DomainMixin

class Organization(TenantMixin):
    TENANT_TYPE_CHOICES = [
        ('MSP', 'Multi-Service Provider'),
        ('STP', 'Single Tenant Portal'),
    ]

    # Business vertical for STP orgs (room booking, hotel, hospital, ...) —
    # what drives per-vertical UI/functionality down the line. MSP orgs are
    # purely administrative and never get one (stays null).
    ORG_TYPE_CHOICES = [
        ('ROOM_BOOKING', 'Room Booking & Reservations'),
        ('HOTEL', 'Hotel & Resort Management'),
        ('HOSPITAL', 'Hospital & Healthcare Management'),
        ('OTHER', 'Other'),
    ]

    name = models.CharField(max_length=100)
    logo = models.ImageField(upload_to='org_logos/', null=True, blank=True)
    tenant_type = models.CharField(max_length=3, choices=TENANT_TYPE_CHOICES)
    org_type = models.CharField(
        max_length=20, choices=ORG_TYPE_CHOICES, null=True, blank=True,
        help_text='Business vertical for STP organizations only; MSP organizations leave this unset.'
    )
    parent_organization = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='sub_organizations'
    )
    # Optional geolocation, e.g. for plotting organizations on a dashboard map.
    latitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True,
        validators=[MinValueValidator(-90), MaxValueValidator(90)],
    )
    longitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True,
        validators=[MinValueValidator(-180), MaxValueValidator(180)],
    )
    is_active = models.BooleanField(default=True)
    created_on = models.DateTimeField(auto_now_add=True)
    updated_on = models.DateTimeField(auto_now=True)
    
    auto_create_schema = True
    auto_drop_schema = True
    
    class Meta:
        db_table = 'organizations'
    
    def __str__(self):
        return self.name


class Domain(DomainMixin):
    pass