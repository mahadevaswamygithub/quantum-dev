"""
log_activity() — the one call site every view uses to write an
ActivityLog row. Kept deliberately simple (no signals, no middleware
magic) to match this codebase's existing style of explicit, readable calls
at the point of action (see e.g. apps.users.serializers.users._send_invite_email).
"""
from .models import ActivityLog


def _client_ip(request):
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if forwarded:
        return forwarded.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


def log_activity(request, action, *, obj=None, model_name='', object_repr='',
                  organization=None, changes=None, actor=None):
    """
    Writes one ActivityLog row.

    - `request` supplies the actor (request.user) and IP unless `actor` is
      passed explicitly (needed for LOGIN, where the log happens inside the
      same request that just authenticated the user).
    - `obj`, if given, supplies model_name/object_id/object_repr
      automatically — pass object_repr/model_name directly instead when
      `obj` is about to be deleted (repr it into the log while it still
      exists) or already gone.
    - `organization` should be the org this event is *about*: the target
      record's org for CRUD, the actor's own org for login/logout. Falls
      back to the actor's own organization when omitted.
    - `changes`: {field: [old, new]} for updates; left as None otherwise.
    """
    who = actor or getattr(request, 'user', None)
    if who is not None and not getattr(who, 'is_authenticated', True):
        who = None

    if obj is not None:
        model_name = model_name or obj.__class__.__name__
        object_id = str(getattr(obj, 'pk', '') or '')
        object_repr = object_repr or str(obj)
    else:
        object_id = ''

    if organization is None and who is not None:
        organization = getattr(who, 'organization', None)

    ActivityLog.objects.create(
        actor=who,
        actor_username=getattr(who, 'username', '') or '',
        actor_role=getattr(who, 'role', '') or '',
        organization=organization,
        action=action,
        model_name=model_name,
        object_id=object_id,
        object_repr=object_repr[:255],
        changes=changes,
        ip_address=_client_ip(request) if request is not None else None,
    )


def diff_fields(instance, validated_data, fields):
    """
    Snapshot-free diff helper for UPDATE logging: compares `instance`'s
    *current* attribute values (call this BEFORE serializer.save()) against
    whatever `validated_data` would set them to, for the given `fields`.
    Returns {field: [old, new]} for only the fields that actually change —
    a PUT that resends unchanged values doesn't show up as a no-op "change".
    """
    changes = {}
    for f in fields:
        if f not in validated_data:
            continue
        old = getattr(instance, f, None)
        new = validated_data[f]
        old_s, new_s = str(old) if old is not None else None, str(new) if new is not None else None
        if old_s != new_s:
            changes[f] = [old_s, new_s]
    return changes
