"""
chat/views.py

KEY FIX: Removed ChatActionViewSet entirely.
         send/ and stream/ are now plain APIView classes with explicit URL paths.
         ViewSet @action on a router registered at "" never generates /send/ or /stream/.
"""

import json
import logging

import httpx
from django.conf import settings
from django.http import StreamingHttpResponse
from rest_framework import viewsets, status, mixins
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication

from .models import ChatSession, ChatMessage
from .serializers import (
    ChatSessionSerializer,
    ChatSessionDetailSerializer,
    ChatMessageSerializer,
    SendMessageSerializer,
    StreamMessageSerializer,
)

logger = logging.getLogger(__name__)
ORCHESTRATOR_URL = getattr(settings, "LLM_ORCHESTRATOR_URL", "http://localhost:8002")


# ── Shared base ───────────────────────────────────────────────────────────────

class ChatBase:
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def _headers(self, request) -> dict:
        user = request.user
        return {
            "Authorization": request.headers.get("Authorization", ""),
            "X-Tenant-ID":   str(getattr(user, "organization_id", "") or ""),
            "X-User-ID":     str(user.id),
            "X-User-Role":   getattr(user, "role", ""),
            "Content-Type":  "application/json",
        }


# ── Session ViewSet ───────────────────────────────────────────────────────────

class ChatSessionViewSet(ChatBase, viewsets.ModelViewSet):
    http_method_names = ["get", "post", "patch", "delete"]

    def get_queryset(self):
        return ChatSession.objects.filter(
            user=self.request.user
        ).prefetch_related("messages")

    def get_serializer_class(self):
        return ChatSessionDetailSerializer if self.action == "retrieve" else ChatSessionSerializer

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def destroy(self, request, *args, **kwargs):
        session = self.get_object()
        # Best-effort: clear orchestrator memory too
        try:
            with httpx.Client(timeout=5.0) as client:
                client.delete(
                    f"{ORCHESTRATOR_URL}/chat/sessions/{session.id}",
                    headers=self._headers(request),
                )
        except Exception:
            pass
        session.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["get"], url_path="history")
    def history(self, request, pk=None):
        """GET /api/chat/sessions/<id>/history/"""
        session = self.get_object()
        try:
            with httpx.Client(timeout=10.0) as client:
                resp = client.get(
                    f"{ORCHESTRATOR_URL}/chat/sessions/{session.id}/history",
                    headers=self._headers(request),
                )
                resp.raise_for_status()
                return Response(resp.json())
        except Exception as e:
            logger.warning(f"Orchestrator history unavailable: {e}")
            msgs = ChatMessage.objects.filter(session=session)
            return Response({
                "session_id": str(session.id),
                "messages": ChatMessageSerializer(msgs, many=True).data,
            })


# ── Message ViewSet (read-only, nested) ───────────────────────────────────────

class ChatMessageViewSet(
    ChatBase,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = ChatMessageSerializer

    def get_queryset(self):
        return ChatMessage.objects.filter(
            session__id=self.kwargs["session_pk"],
            session__user=self.request.user,
        )


# ── Send View ─────────────────────────────────────────────────────────────────

class ChatSendView(ChatBase, APIView):
    """
    POST /api/chat/send/
    Body: { "message": "...", "session_id": "uuid" }
    Returns full JSON — no streaming.
    """

    def post(self, request):
        serializer = SendMessageSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        message    = serializer.validated_data["message"]
        session_id = str(serializer.validated_data["session_id"])

        session, _ = ChatSession.objects.get_or_create(
            id=session_id,
            defaults={"user": request.user, "title": message[:60]},
        )

        try:
            with httpx.Client(timeout=120.0) as client:
                resp = client.post(
                    f"{ORCHESTRATOR_URL}/chat/message",
                    json={"message": message, "session_id": session_id},
                    headers=self._headers(request),
                )
                resp.raise_for_status()
                data = resp.json()

            text = data.get("response", "")
            ChatMessage.objects.create(session=session, role=ChatMessage.ROLE_USER, content=message)
            ChatMessage.objects.create(session=session, role=ChatMessage.ROLE_ASSISTANT, content=text)

            if session.title == "New Chat":
                session.title = message[:60]
                session.save(update_fields=["title", "updated_at"])

            return Response({"success": True, "response": text, "session_id": session_id})

        except httpx.HTTPStatusError as e:
            logger.error(f"Orchestrator error: {e.response.status_code}")
            return Response({"error": "AI service error"}, status=502)
        except httpx.RequestError as e:
            logger.error(f"Orchestrator unreachable: {e}")
            return Response({"error": "AI service unavailable"}, status=503)


# ── Stream View ───────────────────────────────────────────────────────────────

class ChatStreamView(ChatBase, APIView):
    """
    POST /api/chat/stream/
    Body: { "message": "...", "session_id": "uuid" }

    Proxies SSE stream from orchestrator to React.
    Events: tool_start, tool_end, token, done, error
    """

    def post(self, request):
        serializer = StreamMessageSerializer(data=request.data)
        if not serializer.is_valid():
            err = f"data: {json.dumps({'type': 'error', 'message': str(serializer.errors)})}\n\n"
            return StreamingHttpResponse(iter([err]), content_type="text/event-stream")

        message    = serializer.validated_data["message"]
        session_id = str(serializer.validated_data["session_id"])
        headers    = self._headers(request)

        ChatSession.objects.get_or_create(
            id=session_id,
            defaults={"user": request.user, "title": message[:60]},
        )

        def event_stream():
            tokens = []
            try:
                with httpx.Client(timeout=180.0) as client:
                    with client.stream(
                        "POST",
                        f"{ORCHESTRATOR_URL}/chat/stream",
                        json={"message": message, "session_id": session_id},
                        headers=headers,
                    ) as resp:
                        resp.raise_for_status()
                        for chunk in resp.iter_text():
                            if chunk:
                                yield chunk
                                # collect tokens for DB save
                                for line in chunk.split("\n"):
                                    if line.startswith("data: "):
                                        try:
                                            ev = json.loads(line[6:])
                                            if ev.get("type") == "token":
                                                tokens.append(ev.get("content", ""))
                                        except Exception:
                                            pass
            except httpx.HTTPStatusError as e:
                logger.error(f"Orchestrator stream error: {e.response.status_code}")
                yield f"data: {json.dumps({'type': 'error', 'message': 'AI service error'})}\n\n"
            except Exception as e:
                logger.error(f"Stream proxy error: {e}")
                yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
            finally:
                if tokens:
                    try:
                        s = ChatSession.objects.get(id=session_id)
                        ChatMessage.objects.create(session=s, role=ChatMessage.ROLE_USER, content=message)
                        ChatMessage.objects.create(session=s, role=ChatMessage.ROLE_ASSISTANT, content="".join(tokens))
                        if s.title == "New Chat":
                            s.title = message[:60]
                            s.save(update_fields=["title", "updated_at"])
                    except Exception as e:
                        logger.error(f"DB persist error: {e}")

        response = StreamingHttpResponse(event_stream(), content_type="text/event-stream")
        response["Cache-Control"] = "no-cache"
        response["X-Accel-Buffering"] = "no"
        return response