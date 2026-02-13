import os
import smtplib
from email.mime.text import MIMEText
import sys

def main():
    smtp_server = os.getenv('SMTP_SERVER')
    smtp_port = os.getenv('SMTP_PORT')
    smtp_user = os.getenv('SMTP_USER')
    smtp_password = os.getenv('SMTP_PASSWORD')
    email_from = os.getenv('EMAIL_FROM')
    email_to = os.getenv('EMAIL_TO_ADMIN')

    if not all([smtp_server, smtp_port, smtp_user, smtp_password, email_from, email_to]):
        print("Error: Missing SMTP configuration in .env")
        sys.exit(1)

    print(f"Connecting to SMTP: {smtp_server}:{smtp_port}...")

    try:
        msg = MIMEText("This is a test email from Floormad Automation B.L.A.S.T. Protocol.")
        msg['Subject'] = "Floormad Link Verification"
        msg['From'] = email_from
        msg['To'] = email_to

        with smtplib.SMTP(smtp_server, int(smtp_port)) as server:
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.sendmail(email_from, [email_to], msg.as_string())
        
        print("SUCCESS: Test email sent.")
            
    except Exception as e:
        print(f"FAILURE: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
