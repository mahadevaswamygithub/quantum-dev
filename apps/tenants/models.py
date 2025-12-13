from django.db import models
from django_tenants.models import TenantMixin, DomainMixin

class Organization(TenantMixin):
    TENANT_TYPE_CHOICES = [
        ('MSP', 'Multi-Service Provider'),
        ('STP', 'Single Tenant Portal'),
    ]
    
    name = models.CharField(max_length=100)
    tenant_type = models.CharField(max_length=3, choices=TENANT_TYPE_CHOICES)
    parent_organization = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='sub_organizations'
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