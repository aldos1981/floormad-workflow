import smtplib
import ssl
from email.mime.text import MIMEText

HOST = "mail.agrilock.eu"
USER = "workflow@agrilock.eu"
PASS = "123workflow456"

def test_port_465():
    print(f"\n--- Testing Port 465 (SSL/TLS) ---")
    try:
        # Create a secure SSL context
        context = ssl.create_default_context()
        # Option to disable verification if needed (for finding root cause)
        # context.check_hostname = False
        # context.verify_mode = ssl.CERT_NONE

        server = smtplib.SMTP_SSL(HOST, 465, context=context)
        print("Connected.")
        server.login(USER, PASS)
        print("Logged in.")
        server.quit()
        print("SUCCESS 465")
    except Exception as e:
        print(f"FAIL 465: {e}")

def test_port_587():
    print(f"\n--- Testing Port 587 (STARTTLS) ---")
    try:
        server = smtplib.SMTP(HOST, 587)
        print("Connected.")
        server.starttls()
        print("STARTTLS secure.")
        server.login(USER, PASS)
        print("Logged in.")
        server.quit()
        print("SUCCESS 587")
    except Exception as e:
        print(f"FAIL 587: {e}")

if __name__ == "__main__":
    test_port_465()
    test_port_587()
