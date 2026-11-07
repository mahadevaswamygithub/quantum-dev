from django.core.validators import MinValueValidator, MaxValueValidator
from django.db import models
from django.db.models import Q
from django_tenants.models import TenantMixin, DomainMixin


# Account status, set by the platform owner (apps.tenants.platform_views).
# Order matters: a property is as restricted as the worse of its own status and
# its customer's (parent MSP's) status.
STATUS_ORDER = ('ACTIVE', 'PENDING', 'SUSPENDED', 'CLOSED')
# Staff of these accounts cannot sign in; their properties are hidden from guests.
BLOCKED_STATUSES = ('SUSPENDED', 'CLOSED')


class OrganizationQuerySet(models.QuerySet):
    def bookable(self):
        """Properties guests can see and book: an active ROOM_BOOKING STP whose
        account, and whose customer (parent MSP) account, are approved and on."""
        return self.filter(
            tenant_type='STP', org_type='ROOM_BOOKING', is_active=True, status='ACTIVE',
        ).filter(
            Q(parent_organization__isnull=True)
            | Q(parent_organization__status='ACTIVE', parent_organization__is_active=True)
        )

    def customers(self):
        """Top-level accounts (one per customer): MSPs, and standalone STPs."""
        return self.filter(parent_organization__isnull=True).exclude(schema_name='public')


class Organization(TenantMixin):
    STATUS_CHOICES = [
        ('PENDING', 'Waiting for approval'),
        ('ACTIVE', 'Active'),
        ('SUSPENDED', 'Suspended'),
        ('CLOSED', 'Closed'),
    ]
    TENANT_TYPE_CHOICES = [
        ('MSP', 'Multi-Service Provider'),
        ('STP', 'Single Tenant Portal'),
    ]

    # Business vertical for STP orgs (room booking, hotel, hospital, ...) -
    # what drives per-vertical UI/functionality down the line. MSP orgs are
    # purely administrative and never get one (stays null).
    ORG_TYPE_CHOICES = [
        ('ROOM_BOOKING', 'Room Booking & Reservations'),
        ('HOTEL', 'Hotel & Resort Management'),
        ('HOSPITAL', 'Hospital & Healthcare Management'),
        ('OTHER', 'Other'),
    ]
    # Verticals that are actually built. Only these can be chosen for a new
    # organization (or switched to); the rest stay in ORG_TYPE_CHOICES so
    # existing rows and labels keep working until each vertical ships.
    AVAILABLE_ORG_TYPES = ('ROOM_BOOKING',)

    name = models.CharField(max_length=100)
    logo = models.ImageField(upload_to='org_logos/', null=True, blank=True)
    # Wide banner photo for the public booking site and the /book directory card.
    cover_image = models.ImageField(upload_to='org_covers/', null=True, blank=True)
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
    # Contact details an admin maintains from Settings → Organization; shown
    # to customers on a Room Booking org's public booking site.
    contact_email = models.EmailField(blank=True)
    contact_phone = models.CharField(max_length=30, blank=True)
    address = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    # Customer account lifecycle (platform owner). Existing organizations are ACTIVE.
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='ACTIVE')
    status_reason = models.CharField(max_length=300, blank=True)
    status_changed_at = models.DateTimeField(null=True, blank=True)
    # True when the customer created this account through public sign-up.
    signed_up = models.BooleanField(default=False)
    # Customers (top-level orgs): how many hotels they may have. Null = no limit.
    # MSP: client organizations; standalone STP: properties (see property_count).
    property_limit = models.PositiveIntegerField(null=True, blank=True)
    created_on = models.DateTimeField(auto_now_add=True)
    updated_on = models.DateTimeField(auto_now=True)

    objects = OrganizationQuerySet.as_manager()

    auto_create_schema = True
    auto_drop_schema = True

    class Meta:
        db_table = 'organizations'
        indexes = [
            models.Index(fields=['tenant_type', 'is_active']),
            models.Index(fields=['org_type']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return self.name

    @property
    def customer(self):
        """The customer account this organization belongs to (itself if top-level)."""
        return self.parent_organization or self

    @property
    def effective_status(self):
        """The more restrictive of this organization's status and its customer's."""
        statuses = [self.status]
        if self.parent_organization_id:
            statuses.append(self.parent_organization.status)
        return max(statuses, key=STATUS_ORDER.index)

    def sign_in_problem(self):
        """Why this organization's staff can't sign in, or '' if they can.
        Pending accounts may sign in (to set up); suspended/closed may not."""
        status = self.effective_status
        if status == 'SUSPENDED':
            return 'Your organization’s account is suspended. Please contact CoreX support.'
        if status == 'CLOSED':
            return 'Your organization’s account has been closed.'
        if not self.is_active or (self.parent_organization_id and not self.parent_organization.is_active):
            return 'Your organization has been deactivated. Please contact your administrator.'
        return ''

    def property_count(self):
        """What the property limit counts. An MSP customer: its client
        organizations (closed ones excluded). A standalone STP customer: its
        properties (locations)."""
        if self.tenant_type == 'MSP':
            return self.sub_organizations.exclude(status='CLOSED').count()
        return self.properties.count()

    def property_limit_reached(self):
        return self.property_limit is not None and self.property_count() >= self.property_limit


class Domain(DomainMixin):
    pass


class OrgEmailSettings(models.Model):
    """How an organization's emails to guests are sent (Settings → Email).

    PLATFORM (default): sent through CoreX's mail account, with the
    organization's name as the sender name and its address as Reply-To -
    replies reach the property. CUSTOM: sent through the organization's own
    SMTP server/mailbox, so they come *from* its own address."""
    MODE_CHOICES = [('PLATFORM', 'Sent by CoreX on your behalf'), ('CUSTOM', 'Your own email account')]
    SECURITY_CHOICES = [('TLS', 'STARTTLS (port 587)'), ('SSL', 'SSL/TLS (port 465)'), ('NONE', 'None')]

    organization = models.OneToOneField(Organization, on_delete=models.CASCADE, related_name='email_settings')
    send_booking_emails = models.BooleanField(default=True)
    mode = models.CharField(max_length=10, choices=MODE_CHOICES, default='PLATFORM')
    from_name = models.CharField(max_length=100, blank=True)   # blank → organization name
    reply_to = models.EmailField(blank=True)                    # blank → organization contact email
    # Own email account (CUSTOM)
    smtp_host = models.CharField(max_length=255, blank=True)
    smtp_port = models.PositiveIntegerField(default=587)
    smtp_security = models.CharField(max_length=4, choices=SECURITY_CHOICES, default='TLS')
    smtp_username = models.CharField(max_length=255, blank=True)
    smtp_password_encrypted = models.TextField(blank=True)      # apps.core.crypto - never stored in plain text
    from_email = models.EmailField(blank=True)                  # blank → smtp_username
    last_test_at = models.DateTimeField(null=True, blank=True)
    last_test_ok = models.BooleanField(null=True, blank=True)
    last_test_error = models.CharField(max_length=300, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'org_email_settings'

    def __str__(self):
        return f"Email settings - {self.organization.name}"

    @classmethod
    def for_org(cls, organization):
        obj, _ = cls.objects.get_or_create(organization=organization)
        return obj

    @property
    def custom_ready(self):
        return self.mode == 'CUSTOM' and bool(self.smtp_host and self.smtp_username and self.smtp_password_encrypted)
