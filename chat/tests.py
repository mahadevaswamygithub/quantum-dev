import uuid
from unittest.mock import MagicMock
from django.test import SimpleTestCase
from chat.serializers import SendMessageSerializer, ChatSessionSerializer
from chat.views import ChatBase
from chat.models import ChatSession, ChatMessage


class ChatSerializerTests(SimpleTestCase):
    def test_send_message_serializer_validates_uuid_and_message(self):
        valid_uuid = str(uuid.uuid4())
        data = {
            'message': 'Hello AI Assistant',
            'session_id': valid_uuid,
        }
        serializer = SendMessageSerializer(data=data)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data['message'], 'Hello AI Assistant')
        self.assertEqual(str(serializer.validated_data['session_id']), valid_uuid)

    def test_send_message_serializer_rejects_invalid_uuid(self):
        data = {
            'message': 'Hello AI Assistant',
            'session_id': 'not-a-valid-uuid',
        }
        serializer = SendMessageSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('session_id', serializer.errors)

    def test_chat_session_serializer_truncates_last_message(self):
        session = MagicMock(spec=ChatSession)
        last_msg = MagicMock(spec=ChatMessage)
        last_msg.role = 'assistant'
        last_msg.content = 'A' * 150  # 150 chars
        session.messages.last.return_value = last_msg

        serializer = ChatSessionSerializer()
        result = serializer.get_last_message(session)
        self.assertEqual(result['role'], 'assistant')
        self.assertEqual(len(result['content']), 100)


class ChatBaseHeaderTests(SimpleTestCase):
    def test_chat_base_headers_generation(self):
        chat_base = ChatBase()
        request = MagicMock()
        request.headers = {'Authorization': 'Bearer test-jwt-token'}
        request.user = MagicMock()
        request.user.id = 42
        request.user.organization_id = 9
        request.user.role = 'STP_ADMIN'

        headers = chat_base._headers(request)
        self.assertEqual(headers['Authorization'], 'Bearer test-jwt-token')
        self.assertEqual(headers['X-Tenant-ID'], '9')
        self.assertEqual(headers['X-User-ID'], '42')
        self.assertEqual(headers['X-User-Role'], 'STP_ADMIN')
        self.assertEqual(headers['Content-Type'], 'application/json')
