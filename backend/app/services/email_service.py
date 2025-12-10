"""
Email Service using fastapi-mail for sending invitation emails
"""
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from pydantic import EmailStr
from typing import List
from app.core.config import settings
from loguru import logger


class EmailService:
    """Service for sending emails via SMTP using fastapi-mail"""
    
    def __init__(self):
        self.config = ConnectionConfig(
            MAIL_USERNAME=settings.SMTP_USER,
            MAIL_PASSWORD=settings.SMTP_PASSWORD,
            MAIL_FROM=settings.EMAILS_FROM_EMAIL,
            MAIL_PORT=settings.SMTP_PORT,
            MAIL_SERVER=settings.SMTP_HOST,
            MAIL_FROM_NAME=settings.EMAILS_FROM_NAME,
            MAIL_STARTTLS=True,
            MAIL_SSL_TLS=False,
            USE_CREDENTIALS=True,
            VALIDATE_CERTS=True
        )
        self.fastmail = FastMail(self.config)
    
    async def send_invitation_email(
        self, 
        email: str, 
        token: str, 
        org_name: str,
        inviter_name: str = "A team member"
    ) -> bool:
        """
        Send an invitation email to a user.
        
        Args:
            email: Recipient email address
            token: Invitation token for the join link
            org_name: Name of the organization
            inviter_name: Name of the person who sent the invitation
            
        Returns:
            bool: True if email was sent successfully, False otherwise
        """
        join_link = f"{settings.FRONTEND_URL}/join?token={token}"
        
        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>You're Invited to {org_name}</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5; -webkit-font-smoothing: antialiased;">
            <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5;">
                <tr>
                    <td align="center" style="padding: 48px 24px;">
                        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);">
                            
                            <!-- Content -->
                            <tr>
                                <td style="padding: 56px 48px 48px 48px;">
                                    
                                    <!-- Logo -->
                                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                                        <tr>
                                            <td align="center" style="padding-bottom: 16px;">
                                                <a href="https://sig-ment.com" target="_blank" style="display: inline-block;">
                                                    <img src="https://tkgyfhewbvtkrwcyahdn.supabase.co/storage/v1/object/public/assets/email/sigment-logo.png" 
                                                         alt="SIGMENT" width="48" height="40" style="display: block;">
                                                </a>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td align="center" style="padding-bottom: 40px;">
                                                <div style="width: 40px; height: 2px; background-color: #1a1a1a; border-radius: 1px;"></div>
                                            </td>
                                        </tr>
                                    </table>
                                    
                                    <!-- Heading -->
                                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                                        <tr>
                                            <td align="center" style="padding-bottom: 32px;">
                                                <h1 style="margin: 0; font-size: 36px; font-weight: 300; color: #1a1a1a; line-height: 1.2;">
                                                    You're<br>
                                                    <span style="font-weight: 600;">invited.</span>
                                                </h1>
                                            </td>
                                        </tr>
                                    </table>
                                    
                                    <!-- Invitation Message -->
                                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                                        <tr>
                                            <td align="center" style="padding-bottom: 24px;">
                                                <p style="margin: 0; font-size: 16px; color: #4a4a4a; line-height: 1.6;">
                                                    <strong style="color: #1a1a1a;">{inviter_name}</strong> has invited you to join the <strong style="color: #1a1a1a;">{org_name}</strong> workspace on <strong style="color: #1a1a1a;">SIGMENT</strong>.
                                                </p>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td align="center" style="padding-bottom: 36px;">
                                                <p style="margin: 0; font-size: 14px; color: #6b6b6b; line-height: 1.6;">
                                                    Connect, collaborate, and build the future with your team in a unified, secure environment.
                                                </p>
                                            </td>
                                        </tr>
                                    </table>
                                    
                                    <!-- CTA Button -->
                                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                                        <tr>
                                            <td align="center" style="padding-bottom: 32px;">
                                                <a href="{join_link}" 
                                                   style="display: inline-block; padding: 16px 48px; background-color: #1a1a1a; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase;">
                                                    Join the Team
                                                </a>
                                            </td>
                                        </tr>
                                    </table>
                                    
                                    <!-- Secondary Link -->
                                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                                        <tr>
                                            <td align="center">
                                                <p style="margin: 0; font-size: 12px; color: #9a9a9a; line-height: 1.6;">
                                                    Button not working? Copy and paste this link into your browser:
                                                    <br>
                                                    <a href="{join_link}" style="color: #1a1a1a; text-decoration: underline; word-break: break-all;">{join_link}</a>
                                                </p>
                                            </td>
                                        </tr>
                                    </table>
                                    
                                </td>
                            </tr>
                            
                        </table>
                        
                        <!-- Footer -->
                        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse;">
                            <tr>
                                <td align="center" style="padding: 32px 24px 0 24px;">
                                    <p style="margin: 0 0 8px 0; font-size: 11px; color: #9a9a9a; text-transform: uppercase; letter-spacing: 0.5px;">
                                        © 2025 SIGMENT INC. ALL RIGHTS RESERVED.
                                    </p>
                                    <p style="margin: 0; font-size: 11px; color: #9a9a9a;">
                                        This invitation expires in 2 hours.
                                    </p>
                                </td>
                            </tr>
                        </table>
                        
                    </td>
                </tr>
            </table>
        </body>
        </html>
        """
        
        try:
            message = MessageSchema(
                subject=f"You're invited to join {org_name} on SIGMENT",
                recipients=[email],
                body=html_body,
                subtype=MessageType.html
            )
            
            await self.fastmail.send_message(message)
            logger.info(f"Invitation email sent successfully to {email}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send invitation email to {email}: {str(e)}")
            return False
    
    async def send_email(
        self,
        recipients: List[EmailStr],
        subject: str,
        body: str,
        subtype: MessageType = MessageType.html
    ) -> bool:
        """
        Generic method to send emails.
        
        Args:
            recipients: List of email addresses
            subject: Email subject
            body: Email body content
            subtype: MessageType (html or plain)
            
        Returns:
            bool: True if email was sent successfully, False otherwise
        """
        try:
            message = MessageSchema(
                subject=subject,
                recipients=recipients,
                body=body,
                subtype=subtype
            )
            
            await self.fastmail.send_message(message)
            logger.info(f"Email sent successfully to {', '.join(recipients)}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send email: {str(e)}")
            return False


# Singleton instance for reuse
email_service = EmailService()
