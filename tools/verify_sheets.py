import os
import json
import sys
# Note: User needs to install google-auth google-auth-oauthlib google-auth-httplib2 google-api-python-client
try:
    from google.oauth2.service_account import Credentials
    from googleapiclient.discovery import build
except ImportError:
    print("Error: Missing libraries. Run: pip install google-auth google-api-python-client")
    sys.exit(1)

SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

def main():
    creds_path = os.getenv('GOOGLE_SHEETS_CREDENTIALS_JSON')
    sheet_id = os.getenv('GOOGLE_SHEET_ID')

    if not creds_path or not sheet_id:
        print("Error: Missing GOOGLE_SHEETS_CREDENTIALS_JSON or GOOGLE_SHEET_ID in .env")
        sys.exit(1)

    print(f"Connecting to Sheet ID: {sheet_id}...")
    
    try:
        creds = Credentials.from_service_account_file(creds_path, scopes=SCOPES)
        service = build('sheets', 'v4', credentials=creds)
        
        # Read A1
        sheet = service.spreadsheets()
        result = sheet.values().get(spreadsheetId=sheet_id, range="A1").execute()
        values = result.get('values', [])
        
        print("SUCCESS: Connection established.")
        if not values:
            print("Sheet is empty (or A1 is empty).")
        else:
            print(f"Cell A1 content: {values[0][0]}")
            
    except Exception as e:
        print(f"FAILURE: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
