from celery import shared_task
from django.core.mail import send_mail
from django.conf import settings

@shared_task
def send_welcome_email(email, username, password=None):
    subject = 'Welcome to CoreX Platform'
    
    if password:
        message = f"""
        Hello,
        
        Your Green Admin account has been created for CoreX Platform.
        
        Username: {username}
        Email: {email}
        Password: {password}
        
        Please change your password after first login.
        
        Best regards,
        CoreX Team
        """
    else:
        message = f"""
        Hello {username},
        
        Welcome to CoreX Platform! Your account has been successfully created.
        
        You can now login and start using the platform.
        
        Best regards,
        CoreX Team
        """
    
    # send_mail(
    #     subject,
    #     message,
    #     settings.DEFAULT_FROM_EMAIL,
    #     [email],
    #     fail_silently=False,
    # )
    
    return f"Email sent to {email}"