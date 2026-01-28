from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    UserRegistrationView, 
    LoginView,
    UserViewSet,
    ForgotPasswordView,
    ResetPasswordView,
    ChangePasswordView,
)

# Router for ViewSet endpoints
router = DefaultRouter()
router.register(r'list', UserViewSet, basename='user')

urlpatterns = [
    # Authentication endpoints
    path('register/', UserRegistrationView.as_view(), name='user-register'),
    path('login/', LoginView.as_view(), name='user-login'),

    # Password management
    path('forgot-password/', ForgotPasswordView.as_view(), name='forgot-password'),
    path('reset-password/', ResetPasswordView.as_view(), name='reset-password'),
    path('change-password/', ChangePasswordView.as_view(), name='change-password'),
    
    # User CRUD endpoints (from ViewSet)
    path('', include(router.urls)),
]

print("✓ User URLs loaded")