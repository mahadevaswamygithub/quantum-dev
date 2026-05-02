from django.contrib import admin
from .models import ChatSession, ChatMessage


class ChatMessageInline(admin.TabularInline):
    model  = ChatMessage
    extra  = 0
    fields = ["role", "content", "created_at"]
    readonly_fields = ["created_at"]


@admin.register(ChatSession)
class ChatSessionAdmin(admin.ModelAdmin):
    list_display  = ["id", "user", "title", "message_count", "created_at", "updated_at"]
    list_filter   = ["created_at"]
    search_fields = ["user__email", "title"]
    inlines       = [ChatMessageInline]
    readonly_fields = ["id", "created_at", "updated_at"]

    def message_count(self, obj):
        return obj.messages.count()
    message_count.short_description = "Messages"


@admin.register(ChatMessage)
class ChatMessageAdmin(admin.ModelAdmin):
    list_display  = ["id", "session", "role", "short_content", "created_at"]
    list_filter   = ["role", "created_at"]
    search_fields = ["session__user__email", "content"]
    readonly_fields = ["id", "created_at"]

    def short_content(self, obj):
        return obj.content[:80]
    short_content.short_description = "Content"