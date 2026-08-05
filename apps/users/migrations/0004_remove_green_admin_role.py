# Removes the GREEN_ADMIN role entirely: any existing users still holding
# it are reassigned to an org-appropriate admin role before the choice is
# dropped from the field.

from django.db import migrations, models


def reassign_green_admins(apps, schema_editor):
    User = apps.get_model('users', 'User')
    for user in User.objects.filter(role='GREEN_ADMIN'):
        if user.organization_id and getattr(user.organization, 'tenant_type', None) == 'STP':
            user.role = 'STP_ADMIN'
        else:
            user.role = 'MSP_ADMIN'
        user.save(update_fields=['role'])


def noop_reverse(apps, schema_editor):
    # Role identity of reassigned users is not recoverable; nothing to do.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0003_alter_salarysettings_organization'),
    ]

    operations = [
        migrations.RunPython(reassign_green_admins, noop_reverse),
        migrations.AlterField(
            model_name='user',
            name='role',
            field=models.CharField(
                choices=[
                    ('MSP_ADMIN', 'MSP Admin'),
                    ('MSP_USER', 'MSP User'),
                    ('STP_ADMIN', 'STP Admin'),
                    ('STP_USER', 'STP User'),
                    ('EMPLOYEE', 'Employee'),
                ],
                default='STP_USER',
                max_length=20,
            ),
        ),
    ]
