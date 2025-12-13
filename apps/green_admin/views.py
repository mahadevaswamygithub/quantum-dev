from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from apps.tenants.models import Organization
from apps.users.models import User
from apps.tenants.serializers import OrganizationSerializer
from apps.users.serializers import UserSerializer
from apps.users.permissions import IsGreenAdmin

class AllTenantsView(generics.ListAPIView):
    """Get all tenants - Green Admin only"""
    serializer_class = OrganizationSerializer
    permission_classes = [IsAuthenticated, IsGreenAdmin]
    queryset = Organization.objects.exclude(schema_name='public')

class TenantDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Get, update, or delete a tenant - Green Admin only"""
    serializer_class = OrganizationSerializer
    permission_classes = [IsAuthenticated, IsGreenAdmin]
    queryset = Organization.objects.exclude(schema_name='public')

class AllUsersView(generics.ListAPIView):
    """Get all users across all tenants - Green Admin only"""
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated, IsGreenAdmin]
    queryset = User.objects.all()

class TenantStatsView(APIView):
    """Get statistics about all tenants - Green Admin only"""
    permission_classes = [IsAuthenticated, IsGreenAdmin]
    
    def get(self, request):
        total_tenants = Organization.objects.exclude(schema_name='public').count()
        msp_count = Organization.objects.exclude(schema_name='public').filter(tenant_type='MSP').count()
        stp_count = Organization.objects.exclude(schema_name='public').filter(tenant_type='STP').count()
        total_users = User.objects.count()
        active_users = User.objects.filter(is_active=True).count()
        
        return Response({
            'total_tenants': total_tenants,
            'msp_count': msp_count,
            'stp_count': stp_count,
            'total_users': total_users,
            'active_users': active_users,
        })