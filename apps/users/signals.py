"""Every new MSP/STP organization starts with the preset staff roles."""
from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.core.access import seed_roles


@receiver(post_save, sender='tenants.Organization')
def seed_preset_roles(sender, instance, created, **kwargs):
    if created and instance.tenant_type in ('MSP', 'STP'):
        seed_roles(instance)
