"""
User CRUD endpoints — mounted at /api/users/.

/api/users/list/           GET=list  POST=create
/api/users/list/<id>/      GET=detail PUT=update DELETE=delete
/api/users/list/<id>/toggle_active/
/api/users/list/<id>/change_role/
/api/users/list/<id>/upload_picture/
/api/users/list/<id>/documents/  [+ /<doc_id>/]
/api/users/list/bulk_activate/ /bulk_deactivate/ /bulk_delete/ /bulk_change_role/
/api/users/list/export_csv/ /export_json/ /statistics/
/api/users/me/
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from apps.users.views import OrgRoleViewSet, UserViewSet

router = DefaultRouter()
router.register(r"list", UserViewSet, basename="user")
# Settings → Roles & access: /api/users/roles/ (+ /roles/catalog/)
router.register(r"roles", OrgRoleViewSet, basename="org-role")

urlpatterns = [
    path("", include(router.urls)),
    # NOTE: this was previously GET-only ({"get": "me"}), which meant the
    # frontend's `updateProfile: (data) => api.put('/users/me/', data)`
    # call 405'd. PUT is now bound to the same `me` action, which already
    # supported PUT internally (see UserViewSet.me) but was unreachable.
    path("me/", UserViewSet.as_view({"get": "me", "put": "me", "delete": "me"}), name="user-me"),
]
