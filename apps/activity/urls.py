"""Activity log endpoint — mounted at /api/activity/.

/api/activity/            GET  list (filters: action, model_name, search, date_from, date_to)
/api/activity/<id>/       GET  retrieve
"""
from rest_framework.routers import DefaultRouter
from .views import ActivityLogViewSet

router = DefaultRouter()
router.register(r'', ActivityLogViewSet, basename='activity-log')

urlpatterns = router.urls
