import json
import traceback
import math 
from datetime import datetime
from database import get_db_connection
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from tools.llm_utils import generate_json, generate_text
import os
from dotenv import load_dotenv

load_dotenv()

SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

import requests # NEW IMPORT

from google.oauth2.credentials import Credentials as UserCredentials

def get_google_sheets_service(service_account_json=None, oauth_creds=None, project_id=None):
    creds = None
    if oauth_creds:
        try:
            creds_dict = json.loads(oauth_creds) if isinstance(oauth_creds, str) else oauth_creds
            creds = UserCredentials(
                token=creds_dict.get('token'),
                refresh_token=creds_dict.get('refresh_token'),
                token_uri=creds_dict.get('token_uri', 'https://oauth2.googleapis.com/token'),
                client_id=creds_dict.get('client_id'),
                client_secret=creds_dict.get('client_secret'),
                scopes=creds_dict.get('scopes', SCOPES)
            )
            
            # Auto-refresh if expired or no token
            if not creds.token or (creds.expired and creds.refresh_token):
                from google.auth.transport.requests import Request
                print("[OAuth] Token expired or missing, refreshing...")
                creds.refresh(Request())
                print(f"[OAuth] ✅ Token refreshed successfully. New expiry: {creds.expiry}")
                
                # Save refreshed token back to database
                if project_id:
                    try:
                        updated_creds = {
                            'token': creds.token,
                            'refresh_token': creds.refresh_token,
                            'token_uri': creds.token_uri,
                            'client_id': creds.client_id,
                            'client_secret': creds.client_secret,
                            'scopes': list(creds.scopes) if creds.scopes else SCOPES,
                            'expiry': creds.expiry.isoformat() if creds.expiry else None
                        }
                        conn = get_db_connection()
                        conn.execute(
                            'UPDATE projects SET oauth_credentials = ? WHERE id = ?',
                            (json.dumps(updated_creds), project_id)
                        )
                        conn.commit()
                        conn.close()
                        print(f"[OAuth] ✅ Refreshed token saved to DB for project {project_id}")
                    except Exception as db_err:
                        print(f"[OAuth] ⚠️ Token refreshed but failed to save to DB: {db_err}")
            elif creds.token:
                # Token exists and not expired — check if it will expire soon (within 5 min)
                if creds.expiry:
                    from datetime import timezone
                    remaining = (creds.expiry.replace(tzinfo=timezone.utc) - datetime.now(timezone.utc)).total_seconds()
                    if remaining < 300:  # Less than 5 min
                        from google.auth.transport.requests import Request
                        print(f"[OAuth] Token expiring in {int(remaining)}s, pre-refreshing...")
                        creds.refresh(Request())
                        print(f"[OAuth] ✅ Token pre-refreshed. New expiry: {creds.expiry}")
                        
        except Exception as e:
            print(f"Error loading OAuth creds: {e}")
            import traceback
            traceback.print_exc()
            
    if not creds and service_account_json:
        creds_dict = json.loads(service_account_json)
        creds = Credentials.from_service_account_info(creds_dict, scopes=SCOPES)
        
    if not creds:
        raise ValueError("No valid credentials found (OAuth or Service Account)")

    service = build('sheets', 'v4', credentials=creds)
    return service.spreadsheets()

def get_google_drive_service(oauth_creds):
    # Only supports OAuth for Picker flow usually
    creds_dict = json.loads(oauth_creds) if isinstance(oauth_creds, str) else oauth_creds
    creds = UserCredentials(
        token=creds_dict['token'],
        refresh_token=creds_dict['refresh_token'],
        token_uri=creds_dict['token_uri'],
        client_id=creds_dict['client_id'],
        client_secret=creds_dict['client_secret'],
        scopes=creds_dict['scopes']
    )
    service = build('drive', 'v3', credentials=creds)
    return service

def fetch_pending_requests(project_it, sheet_service, filter_config=None):
    # This function will read the sheet and return rows that need processing
    
    sheet_id = project_it['google_sheet_id']
    # Allow range override from project config if available, else default
    # Extended to AZ to capture columns beyond Z (e.g., Facebook Lead status in AA)
    range_name = project_it.get('google_sheet_range', "Foglio1!A1:AZ500") 
    
    try:
        result = sheet_service.values().get(spreadsheetId=sheet_id, range=range_name).execute()
        rows = result.get('values', [])
    except Exception as e:
        print(f"Error fetching sheet: {e}")
        return []
    
    if not rows:
        return []

    # Detect if first row is a header or data
    first_row = [str(c).strip() for c in rows[0]]
    is_headerless = False
    for h in first_row:
        if len(h) > 50 or h.startswith('l:') or h.startswith('ag:') or h.startswith('f:') or h.startswith('as:') or h.startswith('c:') or h.startswith('p:'):
            is_headerless = True
            break
    
    max_cols = max(len(r) for r in rows)
    
    if is_headerless:
        print(f"[Sheet Debug] Headerless sheet detected! Generating column names for {max_cols} columns.")
        # Generate generic column names (col_A, col_B, ..., col_AA, etc.)
        headers = []
        for i in range(max_cols):
            col_letter = chr(65 + i) if i < 26 else chr(64 + i//26) + chr(65 + i%26)
            headers.append(f'col_{col_letter}')
        data_rows = rows  # ALL rows are data
        start_row = 1     # 1-indexed
    else:
        headers = [h.strip() for h in rows[0]]
        data_rows = rows[1:]
        start_row = 2
    
    print(f"[Sheet Debug] Headers ({len(headers)}): {headers}")
    print(f"[Sheet Debug] Total data rows: {len(data_rows)}")
    
    # Filter Configuration — only apply if explicitly configured
    target_col = None
    target_val = ""
    
    if filter_config:
        if filter_config.get('column'):
            target_col = filter_config.get('column')
        if 'value' in filter_config:
            target_val = filter_config.get('value', "")

    print(f"[Sheet Debug] Filter: column='{target_col}', value='{target_val}'")

    # Find Column Index
    status_idx = None
    lower_headers = [h.lower() for h in headers]
    try:
        status_idx = headers.index(target_col)
        print(f"[Sheet Debug] Found column '{target_col}' at index {status_idx}")
    except ValueError:
        try:
            status_idx = lower_headers.index(target_col.lower())
            print(f"[Sheet Debug] Found case-insensitive match at index {status_idx}")
        except ValueError:
            print(f"[Sheet Debug] Column '{target_col}' not found — processing ALL rows without filter")

    data = []
    for i, row in enumerate(data_rows, start=start_row):
        # Pad row if it's shorter than headers
        if len(row) < len(headers):
            row += [''] * (len(headers) - len(row))
            
        # Apply filter only if we found the column
        if status_idx is not None:
            cell_val = row[status_idx].strip() if len(row) > status_idx else ""
            match = False
            if target_val == "":
                if not cell_val: match = True
            else:
                if cell_val == target_val: match = True
            if not match:
                continue
        
        item = dict(zip(headers, row))
        item['_row_number'] = i
        data.append(item)
    
    print(f"[Sheet Debug] Matched {len(data)} rows")
    return data


def update_sheet_cell(sheet_service, sheet_id, sheet_range_base, row_number, col_name, value, headers=None):
    """
    Update a specific cell in a Google Sheet row.
    If headers is None, we need to figure out the column index from the sheet.
    col_name can be a column header name or a column letter (A, B, ..., AA, etc.)
    """
    try:
        # If we have headers, find the column index
        if headers:
            try:
                col_idx = headers.index(col_name)
            except ValueError:
                # Try case-insensitive
                lower_headers = [h.lower() for h in headers]
                try:
                    col_idx = lower_headers.index(col_name.lower())
                except ValueError:
                    # Column not found — append it as a new column
                    col_idx = len(headers)
                    print(f"[Sheet Update] Column '{col_name}' not found, will write to column index {col_idx}")
        else:
            col_idx = 0  # fallback
        
        # Convert column index to letter (A, B, ..., Z, AA, AB, ...)
        def col_to_letter(idx):
            result = ""
            while idx >= 0:
                result = chr(65 + idx % 26) + result
                idx = idx // 26 - 1
            return result
        
        col_letter = col_to_letter(col_idx)
        
        # Extract sheet name from range (e.g., "Foglio1!A:Z" -> "Foglio1")
        sheet_name = "Foglio1"
        if sheet_range_base and '!' in sheet_range_base:
            sheet_name = sheet_range_base.split('!')[0]
        
        cell_range = f"{sheet_name}!{col_letter}{row_number}"
        
        body = {"values": [[str(value)]]}
        sheet_service.values().update(
            spreadsheetId=sheet_id,
            range=cell_range,
            valueInputOption="USER_ENTERED",
            body=body
        ).execute()
        
        print(f"[Sheet Update] ✅ Updated {cell_range} = '{value}'")
        return True
    except Exception as e:
        print(f"[Sheet Update] ❌ Error updating cell: {e}")
        return False


def get_next_counter(sheet_service, sheet_id, sheet_range_base, col_name, headers=None):
    """
    Scan a column in the sheet and return max_value + 1.
    Used for auto-incrementing counters like quote numbers.
    """
    try:
        # Extract sheet name
        sheet_name = "Foglio1"
        if sheet_range_base and '!' in sheet_range_base:
            sheet_name = sheet_range_base.split('!')[0]
        
        # If we have headers, find the column index
        if headers:
            try:
                col_idx = headers.index(col_name)
            except ValueError:
                lower_headers = [h.lower() for h in headers]
                try:
                    col_idx = lower_headers.index(col_name.lower())
                except ValueError:
                    col_idx = len(headers)
                    print(f"[Counter] Column '{col_name}' not found, using index {col_idx}")
        else:
            col_idx = 0
        
        # Column letter
        def col_to_letter(idx):
            result = ""
            while idx >= 0:
                result = chr(65 + idx % 26) + result
                idx = idx // 26 - 1
            return result
        
        col_letter = col_to_letter(col_idx)
        col_range = f"{sheet_name}!{col_letter}:{col_letter}"
        
        result = sheet_service.values().get(spreadsheetId=sheet_id, range=col_range).execute()
        values = result.get('values', [])
        
        # Find max numeric value
        max_val = 0
        for row in values:
            if row and row[0]:
                try:
                    num = int(str(row[0]).strip())
                    if num > max_val:
                        max_val = num
                except (ValueError, TypeError):
                    pass
        
        next_val = max_val + 1
        print(f"[Counter] Column '{col_name}' ({col_letter}): max={max_val}, next={next_val}")
        return next_val
    except Exception as e:
        print(f"[Counter] ❌ Error getting counter: {e}")
        return 1  # Default to 1 if error

def get_sheet_headers(project_id):
    conn = get_db_connection()
    project = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    conn.close()
    
    if not project:
        return {'success': False, 'message': 'Project not found'}
        
    try:
        service_account_json = project['service_account_json']
        # Fallback to global settings if project settings empty
        if not service_account_json:
            conn = get_db_connection()
            global_settings = conn.execute("SELECT value FROM settings WHERE key='service_account_json'").fetchone()
            conn.close()
            if global_settings:
                service_account_json = global_settings['value']
        
        if not service_account_json:
             return {'success': False, 'message': 'No Service Account configured'}

        service = get_google_sheets_service(service_account_json)
        sheet_id = project['google_sheet_id']
        
        # Read header row (entire first row)
        result = service.values().get(spreadsheetId=sheet_id, range="1:1").execute()
        rows = result.get('values', [])
        
        if not rows:
            return {'success': True, 'headers': []}
            
        return {'success': True, 'headers': rows[0]}
        
    except Exception as e:
        print(f"Error fetching headers: {e}")
        return {'success': False, 'message': str(e)}

def normalize_locality(row, project):
    """
    Uses AI to normalize locality, extract macro-zone, and clean phone number/mq.
    Ported from n8n 'normalizza_localita' node.
    """
    # Use project prompt or default provided by user
    if project.get('locality_normalization_prompt'):
         system_prompt = project['locality_normalization_prompt']
    else:
         # Default prompt if none provided
         system_prompt = """Sei un assistente che normalizza località italiane.
Restituisci SOLO JSON valido con questi campi:
{
  "località": "",
  "provincia": "",
  "regione": "",
  "fascia_geografica": "",
  "mq": 0
}

Mappa le regioni alle fasce geografiche:
- Nord-est Italia: Veneto, Friuli-Venezia Giulia, Trentino-Alto Adige, Emilia-Romagna
- Nord-ovest Italia: Piemonte, Valle d'Aosta, Liguria, Lombardia
- Centro Italia: Toscana, Umbria, Marche, Lazio, Abruzzo
- Sud Italia: Molise, Campania, Puglia, Basilicata, Calabria
- Isole: Sicilia, Sardegna"""

    # Extract locality and mq from the request
    locality_text = row.get('località', row.get('localita', row.get('location', '')))
    mq_text = row.get('mq', row.get('metri_quadri', row.get('square_meters', '')))
    
    user_prompt = f"""Dati da normalizzare:
Località: {locality_text}
Metri quadri: {mq_text}

Restituisci SOLO il JSON richiesto."""

    # Call LLM
    return generate_json(system_prompt, user_prompt)

def generate_preventivo_email(row, calculation_result, project):
    """
    Generates the email content using AI and detailed HTML template.
    """
    
    # 1. Prepare Data for Prompt
    # We use the specific prompts provided by the user if available in project settings
    # otherwise defaults (but we are setting them now)
    
    normalized_data = calculation_result.get('normalized_data', {})
    totals = calculation_result.get('totals', {})
    
    # Format Date
    date_str = datetime.now().strftime("%d/%m/%Y")
    req_date = row.get('data_richiesta', row.get('Data', date_str))

    # 2. Generate AI Text (Motivational)
    # 2. Generate AI Text (Motivational)
    system_prompt = project.get('email_system_prompt', "You are a helpful assistant.")

    # Construct specific User Prompt with data injection
    user_prompt_template = project.get('email_user_prompt', "Generate a response.")

    # Mapping for prompt variables
    name = row.get('nome', row.get('Nome', 'Cliente'))
    macro_zone = normalized_data.get('macro_zona', 'Zona non specificata')
    desc_project = row.get('descrivi_il_tuo_progetto', '')
    usage = row.get('utilizzo', '')
    
    # Replace N8N-style placeholders with values
    prompt_filled = user_prompt_template \
        .replace("{{ $('check_richieste').item.json.nome }}", name) \
        .replace("{{ $('check_richieste').item.json.data_richiesta }}", req_date) \
        .replace("{{ $json.macro_zona }}", macro_zone) \
        .replace("{{ $('batch').item.json.descrivi_il_tuo_progetto }}", desc_project) \
        .replace("{{ $('batch').item.json.utilizzo }}", usage)

    # Call AI
    ai_text = generate_text(system_prompt, prompt_filled)
    
    # 3. Split content
    parts = ai_text.split("<!--DIVIDER-->")
    part1_content = parts[0]
    part2_content = parts[1] if len(parts) > 1 else ""
    
    # 4. Generate Tables HTML
    
    # --- Client Data Table ---
    client_table = f'''
    <h3 style="color: #006838; font-family: Arial, sans-serif; margin-top: 20px;">Riepilogo dati cliente</h3>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-family: Arial, sans-serif; font-size: 14px;">
        <tr style="background-color: #f2f2f2;"><td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; width: 30%;">Nome</td><td style="padding: 10px; border: 1px solid #ddd;">{name}</td></tr>
        <tr><td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Email</td><td style="padding: 10px; border: 1px solid #ddd;"><a href="mailto:{row.get('email', '')}" style="color: #0066cc;">{row.get('email', '')}</a></td></tr>
        <tr style="background-color: #f2f2f2;"><td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Telefono</td><td style="padding: 10px; border: 1px solid #ddd;">{row.get('telefono', '')}</td></tr>
        <tr><td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Data richiesta</td><td style="padding: 10px; border: 1px solid #ddd;">{req_date}</td></tr>
        <tr style="background-color: #f2f2f2;"><td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Località</td><td style="padding: 10px; border: 1px solid #ddd;">{normalized_data.get('località', '')}</td></tr>
        <tr><td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Utilizzo</td><td style="padding: 10px; border: 1px solid #ddd;">{usage}</td></tr>
        <tr style="background-color: #f2f2f2;"><td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Descrizione progetto</td><td style="padding: 10px; border: 1px solid #ddd;">{desc_project}</td></tr>
    </table>
    '''
    
    # --- Technical Data Table ---
    sconto_display = int(totals.get('sconto_percentuale', 0)*100)
    tech_table = f'''
    <h3 style="color: #006838; font-family: Arial, sans-serif; margin-top: 20px;">Riepilogo tecnico</h3>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-family: Arial, sans-serif; font-size: 14px;">
        <tr style="background-color: #f2f2f2;"><td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; width: 30%;">Superficie richiesta</td><td style="padding: 10px; border: 1px solid #ddd;">{normalized_data.get('mq_richiesti', 0)}</td></tr>
        <tr><td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Numero piastrelle</td><td style="padding: 10px; border: 1px solid #ddd;">{totals.get('num_piastrelle', 0)} pz.</td></tr>
        <tr style="background-color: #f2f2f2;"><td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Peso totale</td><td style="padding: 10px; border: 1px solid #ddd;">{totals.get('peso_totale', 0)} kg</td></tr>
        <tr><td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Zona spedizione</td><td style="padding: 10px; border: 1px solid #ddd;">{normalized_data.get('macro_zona', '')}</td></tr>
        <tr style="background-color: #f2f2f2;"><td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Fascia di prezzo</td><td style="padding: 10px; border: 1px solid #ddd;">{totals.get('fascia_prezzo', 'Standard')}</td></tr>
        <tr><td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Sconto applicato</td><td style="padding: 10px; border: 1px solid #ddd;">{sconto_display}%</td></tr>
        <tr style="background-color: #f2f2f2;"><td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Prezzo unitario</td><td style="padding: 10px; border: 1px solid #ddd;">€ {totals.get('prezzo_unitario', 0):.2f} al m²</td></tr>
    </table>
    '''
    
    # --- Price Table ---
    tot_excl = totals.get('totale_imponibile', 0)
    tot_incl = totals.get('totale_ivato', 0)
    
    price_table = f'''
    <div style="background-color: #006838; color: white; padding: 20px; border-radius: 0px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; font-family: Arial, sans-serif;">
        <div style="font-size: 24px; font-weight: bold;">Totale Preventivo</div>
        <div style="text-align: right;">
            <div style="font-size: 24px; font-weight: bold;">€ {tot_excl:.2f} <span style="font-size: 14px; font-weight: normal;">IVA esclusa</span></div>
            <div style="font-size: 18px; color: #e0e0e0; margin-top: 5px;">€ {tot_incl:.2f} <span style="font-size: 12px;">IVA inclusa (22%)</span></div>
        </div>
    </div>
    '''
    
    # --- Full HTML Assembly ---
    html_content = f'''
    <!DOCTYPE html>
    <html>
    <head>
        <style>body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}</style>
    </head>
    <body style="margin: 0; padding: 0;">
        <div style="max-width: 800px; margin: 0 auto; padding: 20px;">
            <!-- Header with Logo -->
            <div style="text-align: center; margin-bottom: 30px;">
                <img src="https://www.agrilock.eu/wp-content/uploads/2023/04/Agrilock-logo.png" alt="Agrilock" style="max-width: 200px;">
                <h2 style="color: #006838; margin-top: 10px; font-family: Arial, sans-serif;">Preventivo #{row.get('id', 'PRO')}</h2>
            </div>
            
            <!-- Part 1: Intro & Technical -->
            <div style="margin-bottom: 30px; font-family: Arial, sans-serif;">
                {part1_content}
            </div>
            
            <!-- Tables Section -->
            {client_table}
            {tech_table}
            {price_table}
            
            <!-- Part 2: Emotional/Motivational -->
            <div style="margin-bottom: 40px; background-color: #ffffff; padding: 0px; font-family: Arial, sans-serif;">
                {part2_content}
            </div>
            
            <!-- Footer -->
            <div style="border-top: 1px solid #ddd; padding-top: 20px; font-size: 12px; color: #666; line-height: 1.5; font-family: Arial, sans-serif;">
                <strong>AGRILOCK by IN & ON srl</strong><br>
                Tezze del Piave (TV)<br>
                P.Iva: IT04645820269<br>
                Numero Verde: 800.194.245<br>
                Tel: (+39) 335 779 23 95<br>
                Mail: <a href="mailto:info@agrilock.eu" style="color: #0066cc;">info@agrilock.eu</a><br>
                <a href="https://www.agrilock.eu" style="color: #0066cc;">www.agrilock.eu</a>
            </div>
        </div>
    </body>
    </html>
    '''
    
    return html_content

def calculate_pricing(row, normalized_data, project, product_knowledge=None):
    """
    Calculates the price based on MQ and Price List.
    Ported from n8n 'calcola_fascia' + 'prezzi_agrilock' + 'calcola_totali'.
    """
    
    # 0. Extract Macro Zone (check multiple key names)
    macro_zona = (
        normalized_data.get('macro_zona') or 
        normalized_data.get('fascia_geografica') or 
        normalized_data.get('regione') or 
        ''
    )
    
    # 1. Determine Mq — check multiple key names from normalized data AND raw row
    mq = None
    for key in ['mq_richiesti_numero', 'mq', 'metri_quadri', 'square_meters', 'metratura']:
        val = normalized_data.get(key)
        if val and isinstance(val, (int, float)) and val > 0:
            mq = val
            print(f"[Pricing] MQ found in normalized_data['{key}'] = {mq}")
            break
        elif val and isinstance(val, str):
            try:
                mq = float(val.replace(',', '.').strip())
                if mq > 0:
                    print(f"[Pricing] MQ parsed from normalized_data['{key}'] = {mq}")
                    break
            except ValueError:
                pass
    
    # Fallback: try raw row data
    if not mq or mq <= 0:
        for key in ['mq', 'metri_quadri', 'metratura', 'square_meters']:
            val = row.get(key)
            if val:
                try:
                    mq = float(str(val).replace(',', '.').strip())
                    if mq > 0:
                        print(f"[Pricing] MQ found in row['{key}'] = {mq}")
                        break
                except ValueError:
                    pass
    
    # Final fallback
    if not mq or mq <= 0:
        mq = 35
        print(f"[Pricing] ⚠️ MQ not found anywhere, using default: {mq}")
    
    if mq < 10:
        mq = 10
        
    # 3. Fetch Price from Cache & Determine Fascia dynamically
    price_list_cache = project.get('price_list_cache')
    prezzo_unitario = 20.0 # Default fallback
    fascia = "Default"

    # OVERRIDE: Check if product has specific price list file
    if product_knowledge and product_knowledge.get('price_list_file'):
        try:
            # Load specific file
            file_name = product_knowledge.get('price_list_file')
            import os
            base_dir = os.path.dirname(os.path.abspath(__file__))
            
            # Robust Path Logic
            possible_paths = [
                os.path.join(base_dir, "uploads", str(project['id']), file_name),
                os.path.join(os.getcwd(), "uploads", str(project['id']), file_name),
                os.path.join(base_dir, "..", "uploads", str(project['id']), file_name)
            ]
            
            file_path = None
            for p in possible_paths:
                if os.path.exists(p):
                    file_path = p
                    break

            if file_path:
                import pandas as pd
                if file_path.endswith('.csv'):
                    df = pd.read_csv(file_path)
                    df.columns = [str(col).strip().lower() for col in df.columns]
                    df = df.fillna('')
                    price_list_cache = json.dumps(df.to_dict(orient='records'))
                elif file_path.endswith(('.xls', '.xlsx')):
                    df = pd.read_excel(file_path)
                    df.columns = [str(col).strip().lower() for col in df.columns]
                    df = df.fillna('')
                    price_list_cache = json.dumps(df.to_dict(orient='records'))
                elif file_path.endswith('.json'):
                    with open(file_path, 'r') as f:
                        price_list_cache = f.read() # Already JSON
            else:
                 print(f"Warning: Price list file not found path: {file_name}")

        except Exception as e:
             print(f"Error loading price override {file_name}: {e}")

    if price_list_cache:
        try:
            cache = json.loads(price_list_cache)
            # Find match: Product (if avail) + Macro Zone + Fascia (Dynamic)
            
            # Helper to parse price string/float
            def parse_price(val):
                if isinstance(val, (int, float)): return float(val)
                if isinstance(val, str):
                    return float(val.replace('€', '').replace(',', '.').strip())
                return 0.0

            # Helper to parse range string "10-20" or "20,1-35"
            def parse_range(range_str):
                try:
                    parts = range_str.split('-')
                    if len(parts) != 2: return 0, 0
                    min_val = float(parts[0].replace(',', '.').strip())
                    max_val = float(parts[1].replace(',', '.').strip())
                    return min_val, max_val
                except:
                    return 0, 0

            found = False
            for item in cache:
                sheet_region = item.get('regione', '').strip()
                sheet_fascia = item.get('fascia', '').strip()
                
                # Check Region
                if sheet_region.lower() != macro_zona.lower():
                    continue
                    
                # Check Fascia Range
                min_v, max_v = parse_range(sheet_fascia)
                if min_v <= mq <= max_v:
                    prezzo_unitario = parse_price(item.get('prezzo_finale', 20.0))
                    # Also get discount if needed
                    # sconto_str = item.get('sconto_%', '0').replace('%', '')
                    # sconto_num = float(sconto_str.replace(',', '.')) / 100
                    fascia = sheet_fascia
                    found = True
                    break
            
            if not found:
                print(f"Warning: No dynamic price match found for {macro_zona} / {mq}mq. Using default.")
                
        except Exception as e:
            print(f"Error reading price cache: {e}")
            traceback.print_exc()

    
    # 4. Calculate Totals
    totale_materiale = mq * prezzo_unitario
    piastrelle = math.ceil(mq / 0.25)
    peso_totale = piastrelle * 6.7
    
    # Sconto logic (Can be enhanced to read from sheet too, but keeping existing logic for now/backup)
    sconto_num = -0.31
    if abs(sconto_num) <= 1:
        sconto_percentuale = abs(sconto_num * 100)
    else:
        sconto_percentuale = abs(sconto_num)
        
    return {
        "mq": mq,
        "fascia": fascia,
        "macro_zona": macro_zona,
        "prezzo_unitario": prezzo_unitario,
        "totale_materiale": totale_materiale,
        "piastrelle": piastrelle,
        "peso_totale": peso_totale,
        "sconto_percentuale": f"{sconto_percentuale:.0f}%"
    }

def get_google_creds(project_config):
    """
    Returns (creds, type)
    type: 'service_account' or 'api_key'
    """
    import logging
    logger = logging.getLogger('google_creds')
    
    # 1. Try Project Service Account
    sa_json = project_config.get('service_account_json')
    if sa_json and len(sa_json) > 10:
        try:
            info = json.loads(sa_json)
            client_email = info.get('client_email', 'MISSING')
            has_private_key = bool(info.get('private_key'))
            pk_len = len(info.get('private_key', ''))
            logger.info(f"[CREDS] Project SA found: email={client_email}, has_key={has_private_key}, key_len={pk_len}")
            if info.get('client_email'):
                creds = Credentials.from_service_account_info(info, scopes=SCOPES)
                logger.info(f"[CREDS] ✅ Using PROJECT service account: {client_email}")
                return creds, 'service_account'
        except json.JSONDecodeError as e:
            logger.error(f"[CREDS] ❌ Project SA JSON parse error: {e}")
        except Exception as e:
            logger.error(f"[CREDS] ❌ Project SA credential error: {e}")
    else:
        logger.info(f"[CREDS] No project SA found (len={len(sa_json) if sa_json else 0})")

    # 2. Try Global Service Account
    try:
        conn = get_db_connection()
        
        # Check SA
        row_sa = conn.execute("SELECT value FROM settings WHERE key='service_account_json'").fetchone()
        if row_sa and row_sa['value'] and len(row_sa['value']) > 10:
            try:
                info = json.loads(row_sa['value'])
                client_email = info.get('client_email', 'MISSING')
                has_private_key = bool(info.get('private_key'))
                pk_len = len(info.get('private_key', ''))
                logger.info(f"[CREDS] Global SA found: email={client_email}, has_key={has_private_key}, key_len={pk_len}")
                if info.get('client_email'):
                    creds = Credentials.from_service_account_info(info, scopes=SCOPES)
                    conn.close()
                    logger.info(f"[CREDS] ✅ Using GLOBAL service account: {client_email}")
                    return creds, 'service_account'
            except json.JSONDecodeError as e:
                logger.error(f"[CREDS] ❌ Global SA JSON parse error: {e}")
            except Exception as e:
                logger.error(f"[CREDS] ❌ Global SA credential error: {e}")
        else:
            logger.info(f"[CREDS] No global SA found in settings table")
        
        # Check API Key
        row_key = conn.execute("SELECT value FROM settings WHERE key='google_api_key'").fetchone()
        if row_key and row_key['value'] and len(row_key['value']) > 5:
            api_key = row_key['value']
            conn.close()
            logger.info(f"[CREDS] ✅ Using API key (len={len(api_key)})")
            return api_key, 'api_key'
            
        conn.close()
        logger.warning("[CREDS] ❌ No valid credentials found anywhere!")
    except Exception as e:
        try:
            conn.close()
        except:
            pass
        logger.error(f"[CREDS] ❌ DB error: {e}")
        return {"success": False, "message": str(e), "trace": traceback.format_exc()}

def sync_price_list(project_id, sheet_id, sheet_range="Foglio1!A:G"):
    conn = get_db_connection()
    project = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    
    if not project:
        conn.close()
        return {"success": False, "message": "Project not found"}
        
    # Check for Sheet ID
    if not sheet_id or len(sheet_id) < 5:
        # Fallback: Check for uploaded file
        upload_dir = f"uploads/{project_id}"
        import os
        if os.path.exists(upload_dir):
            files = [f for f in os.listdir(upload_dir) if f.endswith(('.xlsx', '.xls', '.csv'))]
            if files:
                # Use the most recently modified file
                latest_file = max([os.path.join(upload_dir, f) for f in files], key=os.path.getmtime)
                conn.close()
                return process_price_list_file(project_id, latest_file)
        
        conn.close()
        return {"success": False, "message": "No Google Sheet ID configured and no uploaded file found."}

    try:
        creds, cred_type = get_google_creds(dict(project))
        
        rows = []
        
        if cred_type == 'service_account':
            service = build('sheets', 'v4', credentials=creds).spreadsheets()
            result = service.values().get(spreadsheetId=sheet_id, range=sheet_range).execute()
            rows = result.get('values', [])
            
        elif cred_type == 'api_key':
            # Use Direct HTTP Request for API Key
            # https://sheets.googleapis.com/v4/spreadsheets/{spreadsheetId}/values/{range}?key={apiKey}
            import urllib.parse
            safe_range = urllib.parse.quote(sheet_range)
            url = f"https://sheets.googleapis.com/v4/spreadsheets/{sheet_id}/values/{safe_range}?key={creds}&majorDimension=ROWS"
            
            resp = requests.get(url)
            if resp.status_code != 200:
                raise Exception(f"API Key Error {resp.status_code}: {resp.text}")
                
            data = resp.json()
            rows = data.get('values', [])
            
        else:
            conn.close()
            return {"success": False, "message": "No valid Service Account or API Key found in Settings."}

        
        if not rows:
            conn.close()
            return {"success": False, "message": "No data found in sheet"}
            
        headers = [str(h).lower() for h in rows[0]] # Normalize headers
        data = []
        
        for row in rows[1:]:
            if not row: continue
            # Pad row
            if len(row) < len(headers):
                row += [''] * (len(headers) - len(row))
            
            item = dict(zip(headers, row))
            data.append(item)
            
        # Update DB
        cache_json = json.dumps(data)
        conn.execute("UPDATE projects SET price_list_cache = ? WHERE id = ?", (cache_json, project_id))
        conn.commit()
        conn.close()
        
        return {"success": True, "message": f"Synced {len(data)} rows using {cred_type}.", "count": len(data)}
        
    except Exception as e:
        conn.close()
        return {"success": False, "message": str(e), "trace": traceback.format_exc()}

def process_price_list_file(project_id, file_path):
    """
    Parses an uploaded Excel/CSV file and updates the price_list_cache.
    """
    try:
        import pandas as pd
        
        # Determine format
        if file_path.endswith('.csv'):
            df = pd.read_csv(file_path)
        else:
            df = pd.read_excel(file_path) # Requires openpyxl
            
        # Normalize Headers
        df.columns = [str(col).strip().lower() for col in df.columns]
        
        # Convert to list of dicts
        # Replace NaN with empty string
        df = df.fillna('')
        data = df.to_dict(orient='records')
        
        if not data:
            return {"success": False, "message": "File is empty"}
            
        # Sync Logic (same as sync_price_list)
        conn = get_db_connection()
        cache_json = json.dumps(data)
        conn.execute("UPDATE projects SET price_list_cache = ? WHERE id = ?", (cache_json, project_id))
        conn.commit()
        conn.close()
        
        return {"success": True, "message": f"Uploaded & Cached {len(data)} rows.", "count": len(data)}
        
    except Exception as e:
        return {"success": False, "message": f"Processing Error: {str(e)}", "trace": traceback.format_exc()}
def optimize_price_list_with_ai(project_id, file_name):
    """
    Uses AI to normalize a price list file into a standard JSON structure.
    Standard: [{ "product_name": str, "region": str, "min_qty": float, "max_qty": float, "price": float, "currency": "EUR" }]
    """
    conn = get_db_connection()
    project = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    conn.close()
    
    if not project:
        return {"success": False, "message": "Project not found"}
        
    import os
    base_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Try multiple possible paths for robustness
    possible_paths = [
        os.path.join(base_dir, "uploads", str(project_id), file_name),
        os.path.join(os.getcwd(), "uploads", str(project_id), file_name),
        os.path.join(base_dir, "..", "uploads", str(project_id), file_name)
    ]
    
    file_path = None
    for p in possible_paths:
        if os.path.exists(p):
            file_path = p
            break
            
    if not file_path:
        return {"success": False, "message": f"File not found: {file_name} (Checked: {[p for p in possible_paths]})"}

    # 1. Read File Content (Sample if too large)
    try:
        import pandas as pd
        if file_name.endswith('.csv'):
            df = pd.read_csv(file_path)
        else:
            df = pd.read_excel(file_path)
            
        # Limit to first 50 rows for AI analysis if generic structure, 
        # BUT for Price List we need the FULL mapping or at least a robust conversion logic.
        # Approach: Ask AI to generate a *Python transformation script* or return normalized JSON for *all* rows?
        # For reliability with unknown size, better to ask AI to map *Columns* and then we apply pandas logic.
        
        # Method A: AI Column Mapping
        columns = list(df.columns)
        sample_data = df.head(5).to_csv()
        
        system_prompt = """You are a Data Normalization Expert. 
        Your goal is to map the user's Price List columns to the System Standard Schema.
        
        System Schema:
        - region (str, e.g. 'Nord', 'Sud', 'Italia', 'Zone 1')
        - min_qty (float, start of range)
        - max_qty (float, end of range)
        - price (float, unit price)
        - currency (str, default 'EUR')
        
        Return a JSON with the mapping: { "region": "source_col_name", "price": "source_col_name", ... }
        If a column is missing implies a default (e.g. no region = 'All'), specify "default": "value".
        """
        
        user_prompt = f"""
        Here is a sample of the CSV/Excel data:
        {sample_data}
        
        Map the columns to the schema. 
        If 'min_qty' and 'max_qty' are in a single column like "10-50", return "qty_range_col": "column_name" and I will parse it.
        Return ONLY valid JSON.
        """
        
        mapping_res = generate_json(system_prompt, user_prompt)
        
        # Apply Mapping (Simplified for now - strictly sticking to user request of "AI optimizes it")
        # Let's try a direct "AI converts everything" for small files, or row-by-row for large?
        # For accurate "Total Price is null" fix, we need the logic to be solid.
        # Let's trust the AI to return the *Normalized Data* directly if rows < 200.
        
        if len(df) < 200:
            full_csv = df.to_csv()
            conversion_prompt = """
            Convert this Price List to a Standard JSON Array.
            Output Format:
            [
              { "region": "...", "min_qty": 0, "max_qty": 100, "price": 25.50 }
            ]
            Rules:
            - Normalize numbers (comma -> dot).
            - Parse ranges (e.g. "10-20") into min/max.
            - If no region, use "Default".
            - Return ONLY JSON.
            """
            
            optimized_data = generate_json("You are a Data Converter.", conversion_prompt + f"\n\nDATA:\n{full_csv}")
            
            # Save Optimized Version
            optimized_filename = f"optimized_{file_name}.json"
            optimized_path = os.path.join(base_dir, "uploads", str(project_id), optimized_filename)
            
            # If list is wrapped
            if isinstance(optimized_data, dict) and 'data' in optimized_data:
                final_list = optimized_data['data']
            elif isinstance(optimized_data, list):
                final_list = optimized_data
            else:
                final_list = []
                
            with open(optimized_path, 'w') as f:
                json.dump(final_list, f, indent=2)
                
            return {
                "success": True, 
                "optimized_file": optimized_filename, 
                "preview": final_list[:5], 
                "count": len(final_list)
            }
        else:
            return {"success": False, "message": "File too large for AI direct conversion (Limit 200 rows)."}

    except Exception as e:
        return {"success": False, "message": f"Optimization Error: {e}", "trace": traceback.format_exc()}

def optimize_knowledge_base_with_ai(project_id, file_name):
    """
    Uses AI to structure Knowledge Base text.
    """
    import os
    base_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Try multiple possible paths for robustness
    possible_paths = [
        os.path.join(base_dir, "uploads", str(project_id), file_name),
        os.path.join(os.getcwd(), "uploads", str(project_id), file_name),
        os.path.join(base_dir, "..", "uploads", str(project_id), file_name)
    ]
    
    file_path = None
    for p in possible_paths:
        if os.path.exists(p):
            file_path = p
            break
    
    if not os.path.exists(file_path):
        return {"success": False, "message": "File not found"}
        
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
            
        system_prompt = """You are a Technical Knowledge Manager.
        Organize the following raw text into a structured Knowledge Base optimized for AI retrieval.
        Structure keys:
        - "product_summary": Brief description.
        - "technical_specs": Key specs list.
        - "faqs": List of Q&A.
        - "selling_points": Key persuasive points.
        - "full_text_optimized": The cleaned full text.
        """
        
        user_prompt = f"Raw Content:\n{content[:15000]}" # Limit chars
        
        optimized_json = generate_json(system_prompt, user_prompt)
        
        # Save
        optimized_filename = f"optimized_{file_name}.json"
        optimized_path = os.path.join(base_dir, "uploads", str(project_id), optimized_filename)
        
        with open(optimized_path, 'w') as f:
            json.dump(optimized_json, f, indent=2)
            
        return {
            "success": True,
            "optimized_file": optimized_filename,
            "preview": optimized_json
        }
        
    except Exception as e:
        return {"success": False, "message": f"KB Optimization Error: {e}"}

        try:
             # Load knowledge file
            file_name = product_knowledge.get('knowledge_base_file')
            import os
            # Construct path
            base_dir = os.path.dirname(os.path.abspath(__file__))
            file_path = os.path.join(base_dir, "uploads", str(project['id']), file_name)
            
            if os.path.exists(file_path):
                # Read content
                # Support PDF? For now assume text/markdown unless we have a PDF reader. 
                # The user mentioned PDF/TXT.
                if file_name.lower().endswith('.pdf'):
                    # TODO: Implement PDF reading. For now, skip or require a library like pypdf.
                    # Let's try to read as text if it's not a pdf, or just basic read.
                    # Since we don't have a PDF library imported, we might just warn or skip.
                    # But wait, we are in a "AI" context, maybe we can use Gemini to read it if we upload it?
                    # For now simplicity: read text files.
                    pass 
                else:
                    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                        knowledge_text = f.read()
                        
        except Exception as e:
             print(f"Error reading knowledge base file: {e}")
    
    # Fallback to descriptions
    if not knowledge_text:
         descriptions = product_knowledge.get('descriptions', []) if product_knowledge else []
         knowledge_text = "\n".join(descriptions)
    
    # --- EMAIL GENERATION ---
    email_system_prompt = f"""Sei un consulente tecnico-commerciale di {product_name}. Il tuo compito è creare un testo motivazionale professionale e convincente, personalizzato in base alla richiesta del cliente. 
Usa queste informazioni sul prodotto:
{knowledge_text}

Restituisci la data nel formato italiano gg/mm/aaaa."""

    email_user_prompt = f"""Genera un testo motivazionale di almeno 800 caratteri in italiano, formattato in HTML.
Il testo deve essere diviso in due parti e separate da <!--DIVIDER-->:

- Ti scrivo un esempio per la prima parte, ma puoi modificarla a tuo piacimento:
Gentile {row.get('nome', 'Cliente')}, come da sua richiesta effettuata giorno {datetime.now().strftime('%d/%m/%Y')}, con consegna a {row.get('località_di_consegna?', '')} le inviamo la nostra proposta per il prodotto {product_name}.

- Usa attentamente i dati del cliente:
  - Descrizione progetto: {row.get('descrivi_il_tuo_progetto', '')}
  - Utilizzo: {row.get('utilizzo', '')}
- Scrivi un testo empatico e personalizzato.

- Inserisci i dati tecnici concreti evidenziandoli sempre in <b> o <i>:
  - dimensioni <b>50×50 cm</b>
  - peso <b>6,7 kg</b>
  - resistenza fino a <b>56 ton/m²</b>
  - caratteristiche: <i>antiscivolo</i>, <i>drenante</i>, <i>durata 10 anni</i>
  - sottolinea che <b>non serve un piastrellista</b> per l’installazione.

2. La seconda parte deve iniziare con un titolo H3 emozionale.
- Sviluppa un testo emozionale e persuasivo.
- Inserisci punti di forza come elenco puntato.
- Non inserire saluti finali.
- Non scrivere mai ```html o ``` nel risultato.

Dividi le due parti con <!--DIVIDER--> e nient’altro."""

    email_content = generate_json(email_system_prompt, email_user_prompt).get('text') # Note: prompt asks for HTML string, not JSON technically, but we use utils.
    # Actually LLM utils force JSON. We might need raw text for this.
    # Let's use `call_llm` directly for text output.
    from tools.llm_utils import call_llm
    
    email_html = call_llm(email_system_prompt, email_user_prompt)
    
    # --- WHATSAPP GENERATION ---
    wa_system_prompt = """Sei l'assistente virtuale di Agrilock.
Il tuo compito è scrivere un messaggio WhatsApp basato sui dati JSON forniti.
REGOLE CRUCIALI:
1. NON INVENTARE DATI. Usa esattamente i numeri forniti.
2. Usa la formattazione WhatsApp: *grassetto*, emoji.
3. Restituisci ESCLUSIVAMENTE un JSON valido chiave: "messaggio_whatsapp"."""

    wa_user_prompt = f"""Genera un messaggio WhatsApp usando questi dati:
- Nome Cliente: {row.get('nome', '')}
- Utilizzo Progetto: {row.get('utilizzo', '')}
- Mq Totali: {pricing['mq']} mq
- Totale IVATO: € {(pricing['totale_materiale'] * 1.22):.2f}

ISTRUZIONI:
1. Saluta il cliente per nome.
2. Scrivi: "Ti abbiamo appena inviato una mail 📧 con il preventivo completo..."
3. Riepilogo schematico.
4. Prezzo Totale Ivato in *grassetto*.
5. Chiudi con call to action."""

    wa_response = generate_json(wa_system_prompt, wa_user_prompt)
    wa_msg = wa_response.get("messaggio_whatsapp", "")
    
    return {
        "email_html": email_html,
        "whatsapp_text": wa_msg
    }

def get_product_knowledge(project, product_name_query=None):
    """
    Retrieves the specific product configuration and knowledge base.
    """
    if not project['products_config']:
        return None
        
    try:
        products = json.loads(project['products_config'])
        if not products:
            return None
        return products[0]
    except:
        return None

def process_project_workflow(project_id):
    conn = get_db_connection()
    project = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    conn.close()
    
    if not project:
        return {"success": False, "message": "Project not found"}
        
    try:
        # Check if Dynamic Workflow (JSON) is available
        if project['workflow_json'] and len(project['workflow_json']) > 10:
            try:
                workflow_data = json.loads(project['workflow_json'])
                # Only use if it has data
                if workflow_data:
                    from workflow_engine import WorkflowEngine
                    
                    # fetch pending rows to pass as context?
                    # WorkflowEngine usually starts with Trigger. 
                    # If manual trigger, we might need to fetch rows inside the workflow (Google Sheet Node).
                    # OR we pass the project context.
                    
                    # Context for Workflow
                    ctx = {"project": dict(project)}
                    
                    # Instantiate Engine
                    # pass API Key if needed
                    api_key = None
                    if project['service_account_json']:
                         # If using SA, we might not need API Key for Sheets, but maybe for Gemini?
                         # Extract API Key from settings if available as fallback for AI
                         pass
                    
                    # Try to get Gemini API Key from settings
                    conn_key = get_db_connection()
                    row_key = conn_key.execute("SELECT value FROM settings WHERE key='google_api_key'").fetchone()
                    conn_key.close()
                    if row_key:
                        api_key = row_key['value']

                    engine = WorkflowEngine(workflow_data, context=ctx, api_key=api_key)
                    run_result = engine.run()
                    
                    # Log run to DB
                    try:
                        import uuid
                        run_id = str(uuid.uuid4())
                        details_json = json.dumps(run_result.get('log', []))
                        # Save final context as output_json
                        output_json = json.dumps(run_result.get('final_context', {}))
                        
                        conn_log = get_db_connection()
                        conn_log.execute(
                            "INSERT INTO runs (id, project_id, status, log_details, output_json) VALUES (?, ?, ?, ?, ?)",
                            (run_id, project_id, "completed", details_json, output_json)
                        )
                        conn_log.commit()
                        conn_log.close()
                    except Exception as e:
                        print(f"Error logging run: {e}")
                    
                    return {
                        "success": True, 
                        "mode": "dynamic_workflow",
                        "message": "Workflow Completed successfully (Dynamic)",
                        "run_id": run_id,
                        "log": run_result.get('log'), 
                        "details": run_result.get('final_context')
                    }
            except Exception as e:
                print(f"Dynamic Workflow Failed, falling back: {e}")
                # Fallback to hardcoded

        service = get_google_sheets_service(project['service_account_json'])
        sheet_service = service
        
        pending_rows = fetch_pending_requests(project, sheet_service)
        
        results = []
        for row in pending_rows:
            # 1. Normalize Locality (AI)
            normalized_data = normalize_locality(row, project)
            
            # 2. Determine Product & Get Knowledge
            product_knowledge = get_product_knowledge(project, row.get('utilizzo'))
            
            # 3. Pricing
            pricing = calculate_pricing(row, normalized_data, project, product_knowledge)
            
            # 4. Generate Content
            content = generate_content(row, pricing, product_knowledge, project)
            
            # 5. Execute & Update
            # TODO: Add logic to update Google Sheet with "preventivo_inviato"
            
            results.append({
                "row": row['_row_number'], 
                "status": "processed (dry run)",
                "normalized": normalized_data,
                "pricing": pricing,
                "content_preview_wa": content['whatsapp_text'][:50] + "..."
            })
            
        return {"success": True, "processed": len(results), "details": results}

    except Exception as e:
        return {"success": False, "message": str(e), "trace": traceback.format_exc()}


def test_project_connection(project_id: str):
    # Re-using process_workflow for test to see full flow
    return process_project_workflow(project_id)

