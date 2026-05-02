"""
chat/urls.py

IMPORTANT: send/ and stream/ must be explicit path() entries — NOT router-registered.
           Registering ChatActionViewSet at "" with @action generates wrong URLs.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_nested import routers

from .views import (
    ChatSessionViewSet,
    ChatMessageViewSet,
    ChatSendView,
    ChatStreamView,
)

# Sessions router
router = DefaultRouter()
router.register("sessions", ChatSessionViewSet, basename="chat-session")

# Nested messages under sessions
sessions_router = routers.NestedDefaultRouter(router, "sessions", lookup="session")
sessions_router.register("messages", ChatMessageViewSet, basename="session-messages")

urlpatterns = [
    # /api/chat/send/
    path("send/",   ChatSendView.as_view(),   name="chat-send"),
    # /api/chat/stream/
    path("stream/", ChatStreamView.as_view(), name="chat-stream"),

    # /api/chat/sessions/ and nested /sessions/<id>/messages/
    path("", include(router.urls)),
    path("", include(sessions_router.urls)),
]