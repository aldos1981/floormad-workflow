import os
import json
import sys
# Note: User needs to install google-auth google-auth-oauthlib google-auth-httplib2 google-api-python-client python-dotenv
try:
    from google.oauth2.service_account import Credentials
    from googleapiclient.discovery import build
    from dotenv import load_dotenv
except ImportError:
    print("Error: Missing libraries. Run: pip install google-auth google-api-python-client python-dotenv")
    sys.exit(1)

SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

def main():
    # Load .env
    load_dotenv()
    
    # Get Credentials
    creds_path = os.getenv('GOOGLE_SHEETS_CREDENTIALS_JSON', 'service-account.json')
    sheet_id = os.getenv('GOOGLE_SHEET_ID')

    if not creds_path or not sheet_id:
        print("Error: Missing GOOGLE_SHEETS_CREDENTIALS_JSON or GOOGLE_SHEET_ID in .env")
        sys.exit(1)

    print(f"Connecting to Sheet ID: {sheet_id}...")
    
    try:
        if not os.path.exists(creds_path):
             print(f"Error: Credentials file not found at {creds_path}")
             sys.exit(1)

        creds = Credentials.from_service_account_file(creds_path, scopes=SCOPES)
        service = build('sheets', 'v4', credentials=creds)
        
        # Read 'Foglio1'!A1:Z5
        range_name = "Foglio1!A1:Z5"
        print(f"Reading range: {range_name}...")
        
        sheet = service.spreadsheets()
        result = sheet.values().get(spreadsheetId=sheet_id, range=range_name).execute()
        values = result.get('values', [])
        
        print("SUCCESS: Connection established.")
        if not values:
            print("Sheet 'lead' is empty or range not found.")
        else:
            print("Data found:")
            for row in values:
                print(row)
            
    except Exception as e:
        print(f"FAILURE: {e}")
        # Helpful error message for 403
        if "403" in str(e):
             print("\nDouble check that you have shared the sheet with the Service Account Email inside your JSON file.")
        sys.exit(1)

if __name__ == '__main__':
    main()
