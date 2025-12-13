from rest_framework import permissions

class IsGreenAdmin(permissions.BasePermission):
    """Only Green Admin can access"""
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'GREEN_ADMIN'

class IsMSPAdmin(permissions.BasePermission):
    """Only MSP Admin can access"""
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'MSP_ADMIN'

class IsSTPAdmin(permissions.BasePermission):
    """Only STP Admin can access"""
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'STP_ADMIN'

class IsAdminRole(permissions.BasePermission):
    """Any admin role can access"""
    def has_permission(self, request, view):
        admin_roles = ['GREEN_ADMIN', 'MSP_ADMIN', 'STP_ADMIN']
        return request.user.is_authenticated and request.user.role in admin_roles