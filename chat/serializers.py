"""
chat/serializers.py
"""

from rest_framework import serializers
from .models import ChatSession, ChatMessage


class ChatMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model  = ChatMessage
        fields = ["id", "role", "content", "created_at"]
        read_only_fields = fields


class ChatSessionSerializer(serializers.ModelSerializer):
    message_count = serializers.SerializerMethodField()
    last_message  = serializers.SerializerMethodField()

    class Meta:
        model  = ChatSession
        fields = ["id", "title", "message_count", "last_message", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_message_count(self, obj):
        return obj.messages.count()

    def get_last_message(self, obj):
        last = obj.messages.last()
        if last:
            return {"role": last.role, "content": last.content[:100]}
        return None


class ChatSessionDetailSerializer(ChatSessionSerializer):
    messages = ChatMessageSerializer(many=True, read_only=True)

    class Meta(ChatSessionSerializer.Meta):
        fields = ChatSessionSerializer.Meta.fields + ["messages"]


class SendMessageSerializer(serializers.Serializer):
    message    = serializers.CharField(max_length=10000)
    session_id = serializers.UUIDField()


class StreamMessageSerializer(serializers.Serializer):
    message    = serializers.CharField(max_length=10000)
    session_id = serializers.UUIDField()