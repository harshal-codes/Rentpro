import smtplib
import os
import random
import string
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

SMTP_EMAIL    = os.getenv("SMTP_EMAIL")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
SMTP_HOST     = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT     = int(os.getenv("SMTP_PORT", 587))


def generate_otp(length: int = 6) -> str:
    return ''.join(random.choices(string.digits, k=length))


def send_email(to_email: str, subject: str, html_body: str) -> bool:
    """Send an HTML email. Returns True on success, False on failure."""
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = f"Property Dekho <{SMTP_EMAIL}>"
        msg["To"]      = to_email
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            server.login(SMTP_EMAIL, SMTP_PASSWORD)
            server.sendmail(SMTP_EMAIL, to_email, msg.as_string())
        print(f"EMAIL SENT to {to_email}: {subject}")
        return True
    except Exception as e:
        print(f"EMAIL ERROR to {to_email}: {e}")
        return False


# ── Email Templates ──────────────────────────────────────────────

def send_welcome_email(to_email: str, name: str, role: str):
    role_label = "Property Owner" if role == "owner" else "Tenant"
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f8fafc;padding:32px;border-radius:16px;">
      <div style="text-align:center;margin-bottom:24px;">
        <h1 style="color:#4f46e5;font-size:28px;margin:0;">🏠 Property Dekho</h1>
      </div>
      <div style="background:white;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <h2 style="color:#1a202c;margin-top:0;">Welcome, {name}! 🎉</h2>
        <p style="color:#64748b;line-height:1.6;">
          Your account has been successfully created as a <strong style="color:#4f46e5;">{role_label}</strong>.
        </p>
        <div style="background:#f0fdf4;border-left:4px solid #10b981;padding:16px;border-radius:8px;margin:20px 0;">
          <p style="margin:0;color:#065f46;font-weight:600;">✅ Account Activated</p>
          <p style="margin:4px 0 0;color:#065f46;font-size:14px;">You can now log in and start using Property Dekho.</p>
        </div>
        <p style="color:#64748b;font-size:13px;">If you did not create this account, please ignore this email.</p>
      </div>
      <p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:24px;">
        © 2024 Property Dekho. All rights reserved.
      </p>
    </div>
    """
    send_email(to_email, "Welcome to Property Dekho! 🏠", html)


def send_otp_email(to_email: str, name: str, otp: str, purpose: str = "login"):
    purpose_text = {
        "login":   "complete your login",
        "signup":  "verify your email address",
    }.get(purpose, "verify your identity")

    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f8fafc;padding:32px;border-radius:16px;">
      <div style="text-align:center;margin-bottom:24px;">
        <h1 style="color:#4f46e5;font-size:28px;margin:0;">🏠 Property Dekho</h1>
      </div>
      <div style="background:white;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <h2 style="color:#1a202c;margin-top:0;">Your OTP Code 🔐</h2>
        <p style="color:#64748b;">Hi <strong>{name}</strong>, use the code below to {purpose_text}:</p>
        <div style="text-align:center;margin:28px 0;">
          <div style="display:inline-block;background:linear-gradient(135deg,#667eea,#764ba2);
                      color:white;font-size:36px;font-weight:900;letter-spacing:12px;
                      padding:20px 40px;border-radius:12px;">
            {otp}
          </div>
        </div>
        <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:16px;border-radius:8px;">
          <p style="margin:0;color:#92400e;font-weight:600;">⏰ Expires in 10 minutes</p>
          <p style="margin:4px 0 0;color:#92400e;font-size:14px;">Never share this code with anyone.</p>
        </div>
      </div>
      <p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:24px;">
        © 2024 Property Dekho. All rights reserved.
      </p>
    </div>
    """
    subject = "Your OTP Code — Property Dekho 🔐"
    send_email(to_email, subject, html)


def send_login_notification(to_email: str, name: str, ip: str = "Unknown"):
    from datetime import datetime
    now = datetime.utcnow().strftime("%d %b %Y, %H:%M UTC")
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f8fafc;padding:32px;border-radius:16px;">
      <div style="text-align:center;margin-bottom:24px;">
        <h1 style="color:#4f46e5;font-size:28px;margin:0;">🏠 Property Dekho</h1>
      </div>
      <div style="background:white;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <h2 style="color:#1a202c;margin-top:0;">New Login Detected 🔔</h2>
        <p style="color:#64748b;">Hi <strong>{name}</strong>, a new login to your account was detected.</p>
        <div style="background:#f8fafc;border-radius:8px;padding:16px;margin:20px 0;">
          <p style="margin:4px 0;color:#374151;font-size:14px;">🕐 <strong>Time:</strong> {now}</p>
          <p style="margin:4px 0;color:#374151;font-size:14px;">🌐 <strong>IP:</strong> {ip}</p>
        </div>
        <div style="background:#fef2f2;border-left:4px solid #ef4444;padding:16px;border-radius:8px;">
          <p style="margin:0;color:#991b1b;font-weight:600;">⚠️ Not you?</p>
          <p style="margin:4px 0 0;color:#991b1b;font-size:14px;">
            If you did not log in, please change your password immediately.
          </p>
        </div>
      </div>
      <p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:24px;">
        © 2024 Property Dekho. All rights reserved.
      </p>
    </div>
    """
    send_email(to_email, "New Login to Your Account — Property Dekho 🔔", html)


def send_failed_attempts_warning(to_email: str, name: str, attempts: int):
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f8fafc;padding:32px;border-radius:16px;">
      <div style="text-align:center;margin-bottom:24px;">
        <h1 style="color:#4f46e5;font-size:28px;margin:0;">🏠 Property Dekho</h1>
      </div>
      <div style="background:white;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <h2 style="color:#ef4444;margin-top:0;">⚠️ Multiple Failed Login Attempts</h2>
        <p style="color:#64748b;">Hi <strong>{name}</strong>, we detected <strong>{attempts} failed login attempts</strong> on your account.</p>
        <div style="background:#fef2f2;border-left:4px solid #ef4444;padding:16px;border-radius:8px;margin:20px 0;">
          <p style="margin:0;color:#991b1b;font-weight:600;">🔒 Your account has been temporarily locked</p>
          <p style="margin:4px 0 0;color:#991b1b;font-size:14px;">
            Too many wrong password attempts. Please wait 15 minutes before trying again,
            or contact support if this wasn't you.
          </p>
        </div>
        <p style="color:#64748b;font-size:13px;">
          If this was you, simply wait 15 minutes and try again with the correct password.
        </p>
      </div>
      <p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:24px;">
        © 2024 Property Dekho. All rights reserved.
      </p>
    </div>
    """
    send_email(to_email, "⚠️ Security Alert — Multiple Failed Login Attempts", html)
