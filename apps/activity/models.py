from django.db import models


class ActivityLog(models.Model):
    """
    Append-only audit trail: who did what, to which record, and when —
    covers CRUD on Organizations/Users plus login/logout, across both the
    MSP and STP portals.

    Rows are never edited or deleted from the app (see ActivityLogViewSet —
    read-only), so `actor`/`organization` use SET_NULL rather than CASCADE:
    a deleted user or org shouldn't take their own history with them. The
    `actor_username`/`actor_role` and `object_repr` fields snapshot
    human-readable text at write time for the same reason — they stay
    readable even after the thing they describe is gone.
    """
    ACTION_CHOICES = [
        ('CREATE', 'Create'),
        ('UPDATE', 'Update'),
        ('DELETE', 'Delete'),
        ('LOGIN', 'Login'),
        ('LOGOUT', 'Logout'),
    ]

    actor = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='activity_logs',
    )
    # Snapshots of the actor at write time — survive the actor being deleted
    # or (for role) later changing role, so old rows still read correctly.
    actor_username = models.CharField(max_length=150, blank=True)
    actor_role = models.CharField(max_length=20, blank=True)

    # The organization this event is scoped to — for record CRUD, the
    # target record's org (so both the acting MSP and the affected STP see
    # it); for login/logout, the actor's own org. Powers the same
    # OrganizationScopedQuerysetMixin every other list view uses.
    organization = models.ForeignKey(
        'tenants.Organization', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='activity_logs',
    )

    action = models.CharField(max_length=10, choices=ACTION_CHOICES)
    model_name = models.CharField(max_length=50, blank=True)   # 'Organization' | 'User' | '' for login/logout
    object_id = models.CharField(max_length=50, blank=True)
    object_repr = models.CharField(max_length=255, blank=True)  # human-readable label, e.g. an org name or user's full name
    changes = models.JSONField(null=True, blank=True)           # {field: [old, new]} for UPDATE; null otherwise
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'activity_logs'
        ordering = ['-created_at']

    def __str__(self):
        who = self.actor_username or 'system'
        what = self.object_repr or self.model_name or ''
        return f"{who} {self.get_action_display()} {what}".strip()
