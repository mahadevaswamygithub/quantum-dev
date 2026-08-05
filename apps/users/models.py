from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    ROLE_CHOICES = [
        ('MSP_ADMIN', 'MSP Admin'),
        ('MSP_USER', 'MSP User'),
        ('STP_ADMIN', 'STP Admin'),
        ('STP_USER', 'STP User'),
        ('EMPLOYEE', 'Employee'),
    ]

    email = models.EmailField(unique=True)
    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150)
    organization = models.ForeignKey(
        'tenants.Organization',
        on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='users'
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='STP_USER')
    phone = models.CharField(max_length=20, null=True, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    address = models.TextField(null=True, blank=True)
    employee_id = models.CharField(max_length=50, null=True, blank=True, unique=True)
    profile_picture = models.ImageField(upload_to='profile_pictures/', null=True, blank=True)
    daily_rate = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    is_auto_generated = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username', 'first_name', 'last_name']

    class Meta:
        db_table = 'users'

    def __str__(self):
        return f"{self.get_full_name()} ({self.email})"

    @property
    def organization_name(self):
        return self.organization.name if self.organization else None

    @property
    def organization_id(self):
        return self.organization.id if self.organization else None


class UserDocument(models.Model):
    DOCUMENT_TYPE_CHOICES = [
        ('AADHAAR', 'Aadhaar Card'),
        ('PAN', 'PAN Card'),
        ('PASSPORT', 'Passport'),
        ('OFFER_LETTER', 'Offer Letter'),
        ('CONTRACT', 'Employment Contract'),
        ('OTHER', 'Other'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='documents')
    document_type = models.CharField(max_length=20, choices=DOCUMENT_TYPE_CHOICES)
    file = models.FileField(upload_to='user_documents/')
    uploaded_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'user_documents'
        unique_together = ('user', 'document_type')

    def __str__(self):
        return f"{self.user.get_full_name()} - {self.document_type}"

    @property
    def file_url(self):
        if self.file:
            return self.file.url
        return None



class AttendanceRecord(models.Model):
    STATUS_CHOICES = [
        ('PRESENT', 'Present'),
        ('ABSENT', 'Absent'),
        ('LEAVE', 'On Leave'),
        ('HALF_DAY', 'Half Day'),
        ('HOLIDAY', 'Holiday'),
        ('WEEKEND', 'Weekend'),
    ]
 
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='attendance_records')
    date = models.DateField()
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='ABSENT')
    check_in = models.TimeField(null=True, blank=True)
    check_out = models.TimeField(null=True, blank=True)
    hours_worked = models.DecimalField(max_digits=4, decimal_places=2, null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    marked_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='attendance_marked'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
 
    class Meta:
        db_table = 'attendance_records'
        unique_together = ('user', 'date')
        ordering = ['-date']
 
    def __str__(self):
        return f"{self.user.get_full_name()} - {self.date} - {self.status}"
 
    def save(self, *args, **kwargs):
        if self.check_in and self.check_out:
            from datetime import datetime, timedelta
            ci = datetime.combine(self.date, self.check_in)
            co = datetime.combine(self.date, self.check_out)
            if co > ci:
                diff = co - ci
                self.hours_worked = round(diff.total_seconds() / 3600, 2)
        super().save(*args, **kwargs)



class SalarySettings(models.Model):
    """Per-organization salary configuration."""
    organization = models.OneToOneField(
        'tenants.Organization',
        on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='users_salary_settings'
    )
    default_daily_rate = models.DecimalField(max_digits=10, decimal_places=2, default=500)
    working_days_per_month = models.IntegerField(default=26)
    overtime_rate_multiplier = models.DecimalField(max_digits=4, decimal_places=2, default=1.5)
    advance_limit_percent = models.IntegerField(default=50)
    salary_day = models.IntegerField(default=1)
    currency = models.CharField(max_length=5, default='INR')
    currency_symbol = models.CharField(max_length=5, default='₹')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
 
    class Meta:
        db_table = 'salary_settings'
 
    def __str__(self):
        return f"Salary Settings — {self.organization.name}"
 
 
class SalaryRecord(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('PROCESSED', 'Processed'),
        ('PAID', 'Paid'),
        ('HOLD', 'On Hold'),
    ]
 
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='salary_records')
    month = models.CharField(max_length=7)          # YYYY-MM
    days_present = models.IntegerField(default=0)
    daily_rate = models.DecimalField(max_digits=10, decimal_places=2)
    gross_salary = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    deductions = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    advances_deducted = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    net_salary = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='PENDING')
    notes = models.TextField(null=True, blank=True)
    processed_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='salary_processed'
    )
    processed_at = models.DateTimeField(null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
 
    class Meta:
        db_table = 'salary_records'
        unique_together = ('user', 'month')
        ordering = ['-month']
 
    def __str__(self):
        return f"{self.user.get_full_name()} — {self.month}"
 
    def calculate(self):
        self.gross_salary = self.daily_rate * self.days_present
        self.net_salary = self.gross_salary - self.deductions - self.advances_deducted
        if self.net_salary < 0:
            self.net_salary = 0
 
 
class SalaryAdvance(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
        ('DEDUCTED', 'Deducted'),
    ]
 
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='salary_advances')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    note = models.TextField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='PENDING')
    requested_on = models.DateField(auto_now_add=True)
    approved_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='advances_approved'
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    deducted_in = models.ForeignKey(
        SalaryRecord, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='advance_deductions'
    )
    created_at = models.DateTimeField(auto_now_add=True)
 
    class Meta:
        db_table = 'salary_advances'
        ordering = ['-created_at']
 
    def __str__(self):
        return f"{self.user.get_full_name()} — ₹{self.amount} ({self.status})"
 
    @property
    def date(self):
        return self.requested_on.strftime('%Y-%m-%d') if self.requested_on else None



class LeaveType(models.Model):
    type_code = models.CharField(max_length=20, unique=True)
    label = models.CharField(max_length=50)
    days_allowed = models.IntegerField(default=12)
    carry_forward = models.BooleanField(default=False)
    paid = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
 
    class Meta:
        db_table = 'leave_types'
 
    def __str__(self):
        return self.label
 
 
class LeaveRequest(models.Model):
    LEAVE_TYPE_CHOICES = [
        ('CASUAL', 'Casual Leave'),
        ('SICK', 'Sick Leave'),
        ('ANNUAL', 'Annual Leave'),
        ('UNPAID', 'Unpaid Leave'),
        ('MATERNITY', 'Maternity Leave'),
        ('PATERNITY', 'Paternity Leave'),
        ('COMPENSATORY', 'Compensatory Leave'),
    ]
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
        ('CANCELLED', 'Cancelled'),
    ]
 
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='leave_requests')
    leave_type = models.CharField(max_length=15, choices=LEAVE_TYPE_CHOICES)
    from_date = models.DateField()
    to_date = models.DateField()
    days = models.IntegerField(default=1)
    reason = models.TextField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='PENDING')
    approved_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='leaves_approved'
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
 
    class Meta:
        db_table = 'leave_requests'
        ordering = ['-created_at']
 
    def __str__(self):
        return f"{self.user.get_full_name()} — {self.leave_type} ({self.from_date} to {self.to_date})"
 
    def save(self, *args, **kwargs):
        if self.from_date and self.to_date:
            delta = (self.to_date - self.from_date).days + 1
            self.days = max(delta, 1)
        super().save(*args, **kwargs)
 
 
class LeaveBalance(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='leave_balances')
    leave_type = models.CharField(max_length=15)
    year = models.IntegerField()
    allocated = models.IntegerField(default=0)
    used = models.IntegerField(default=0)
    remaining = models.IntegerField(default=0)
 
    class Meta:
        db_table = 'leave_balances'
        unique_together = ('user', 'leave_type', 'year')
 
    def __str__(self):
        return f"{self.user.get_full_name()} — {self.leave_type} {self.year}"
 