import json
import traceback
import math 
from datetime import datetime
from database import get_db_connection
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from tools.llm_utils import generate_json

SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

import requests # NEW IMPORT

def get_google_sheets_service(service_account_json):
    creds_dict = json.loads(service_account_json)
    creds = Credentials.from_service_account_info(creds_dict, scopes=SCOPES)
    service = build('sheets', 'v4', credentials=creds)
    return service.spreadsheets()

def fetch_pending_requests(project_it, sheet_service):
    # This function will read the sheet and return rows that need processing
    # For now, it's a stub that reads a fixed range
    # TODO: Implement dynamic range reading and filtering based on "preventivo_inviato" column
    
    sheet_id = project_it['google_sheet_id']
    range_name = "Foglio1!A1:Z100" # Assuming header is row 1
    
    try:
        result = sheet_service.values().get(spreadsheetId=sheet_id, range=range_name).execute()
        rows = result.get('values', [])
    except Exception as e:
        print(f"Error fetching sheet: {e}")
        return []
    
    if not rows:
        return []

    headers = rows[0]
    data = []
    
    # Simple logic: find rows where "preventivo_inviato" is empty
    # We need to find the index of "preventivo_inviato"
    try:
        status_idx = headers.index("preventivo_inviato")
    except ValueError:
        print("Column 'preventivo_inviato' not found in sheet.")
        return []

    for i, row in enumerate(rows[1:], start=2): # start=2 because sheet is 1-indexed and we skipped header
        # Pad row if it's shorter than headers
        if len(row) < len(headers):
            row += [''] * (len(headers) - len(row))
            
        status = row[status_idx].strip()
        if not status: # Empty status means pending
            item = dict(zip(headers, row))
            item['_row_number'] = i # Store row number for updates
            data.append(item)
            
    # ... (existing pending requests logic) ...
            data.append(item)
            
    return data

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
    if project.get('locality_prompt'):
         system_prompt = project['locality_prompt']
    else:
         system_prompt = """Sei un assistente che riceve una località italiana (comune, città o provincia, anche scritta male), un testo “mq_richiesti” e un numero di telefono.
Devi restituire sempre e solo JSON valido con questi campi:

{
  "provincia": "",
  "regione": "",
  "macro_zona": "",
  "mq_richiesti": "",
  "mq_richiesti_numero": 0,
  "telefono_normalizzato": ""
}

località
Devi provare a capire la località e restituire
provincia: sigla provincia italiana (es: CT, MI). se non sicuro lascia ""
regione: nome regione (es: Sicilia). se non sicuro lascia ""
macro_zona: solo uno tra
Nord-est Italia
Nord-ovest Italia
Centro Italia
Sud Italia
Italia Isole

mappa regioni in macro_zona così
Nord-est Italia = Veneto, Trentino-Alto Adige, Friuli Venezia Giulia, Emilia Romagna, Lombardia
Nord-ovest Italia = Piemonte, Valle d’Aosta, Liguria
Centro Italia = Toscana, Umbria, Marche, Lazio, Abruzzo
Sud Italia = Molise, Campania, Puglia, Basilicata, Calabria
Italia Isole = Sicilia, Sardegna

mq_richiesti e mq_richiesti_numero
mq_richiesti: restituisci il testo originale ripulito (trim, spazi doppi rimossi). se vuoto restituisci ""
mq_richiesti_numero: calcola un numero (intero o decimale) seguendo queste regole, in ordine

regole di default
se il testo è vuoto, oppure contiene solo parole vaghe o inutili (es: pochi, nessuno, alcuni, non so, dipende, preventivo, da definire, da valutare, non saprei, circa, più o meno) allora mq_richiesti_numero = 35
se non esiste alcun numero nel testo allora mq_richiesti_numero = 35
se l’utente dichiara assenza (es: 0, nessuno, non mi serve, non ho mq) allora mq_richiesti_numero = 35

estrazione numeri e calcoli
se trovi calcoli tipo 6x3, 6*3, 6×3, calcola il risultato
se trovi “circa 150”, “più o meno 150”, “+ o - 150” prendi solo 150
se trovi intervalli tipo 80-100, 80/100, 80 a 100 prendi il valore più alto (100)
se trovi unità (m, mq, m2, metri quadri) tratta sempre come mq

gestione del minimo
se il valore finale è minore di 10 allora imposta mq_richiesti_numero = 10
se il testo indica esplicitamente “<10” o “meno di 10” o “sotto 10” allora mq_richiesti_numero = 10

telefono_normalizzato
normalizza in formato internazionale con spazi
se numero italiano senza prefisso e lungo 10 cifre, aggiungi +39
se inizia con 00 sostituisci 00 con +
rimuovi caratteri non numerici tranne il +
formatta come “+39 335 123 4567” (gruppi leggibili). se non presente o non riconoscibile restituisci ""

rispondi sempre e solo con JSON valido, senza testo extra"""

    user_prompt = f"""Dati cliente
Località: {row.get('località_di_consegna?', '')}
Mq richiesti: {row.get('mq_richiesti', '')}
Telefono: {row.get('telefono', '')}"""

    # Call LLM
    return generate_json(system_prompt, user_prompt)

def calculate_pricing(row, normalized_data, project, product_knowledge=None):
    """
    Calculates the price based on MQ and Price List.
    Ported from n8n 'calcola_fascia' + 'prezzi_agrilock' + 'calcola_totali'.
    """
    
    # 0. Extract Macro Zone
    macro_zona = normalized_data.get('macro_zona', '')
    
    # 1. Determine Mq
    mq = normalized_data.get('mq_richiesti_numero', 35)
    if not isinstance(mq, (int, float)) or mq <= 0:
        mq = 35
    if mq < 10:
        mq = 10
        
    # 3. Fetch Price from Cache & Determine Fascia dynamically
    price_list_cache = project.get('price_list_cache')
    prezzo_unitario = 20.0 # Default fallback
    fascia = "Default"
    
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
    # 1. Try Project Service Account
    sa_json = project_config.get('service_account_json')
    if sa_json and len(sa_json) > 10:
        try:
            info = json.loads(sa_json)
            # Validation: check for client_email
            if info.get('client_email'):
                creds = Credentials.from_service_account_info(info, scopes=SCOPES)
                return creds, 'service_account'
        except:
            pass # Fallback

    # 2. Try Global Service Account
    try:
        conn = sqlite3.connect('floormad.db')
        conn.row_factory = sqlite3.Row
        
        # Check SA
        row_sa = conn.execute("SELECT value FROM settings WHERE key='service_account_json'").fetchone()
        if row_sa and row_sa['value'] and len(row_sa['value']) > 10:
            info = json.loads(row_sa['value'])
            if info.get('client_email'):
                creds = Credentials.from_service_account_info(info, scopes=SCOPES)
                conn.close()
                return creds, 'service_account'
        
        # Check API Key
        row_key = conn.execute("SELECT value FROM settings WHERE key='google_api_key'").fetchone()
        if row_key and row_key['value'] and len(row_key['value']) > 5:
            api_key = row_key['value']
            conn.close()
            return api_key, 'api_key'
            
        conn.close()
    except Exception as e:
        conn.close()
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

def generate_content(row, pricing, product_knowledge):
    """
    Generates Email and WhatsApp content using AI.
    """
    
    # Extract Product info for the prompt
    product_name = product_knowledge.get('name', 'Agrilock') if product_knowledge else 'Agrilock'
    # descriptions = product_knowledge.get('descriptions', []) if product_knowledge else []
    # knowledge_text = "\n".join(descriptions)
    
    # --- EMAIL GENERATION ---
    email_system_prompt = f"""Sei un consulente tecnico-commerciale di {product_name}. Il tuo compito è creare un testo motivazionale professionale e convincente, personalizzato in base alla richiesta del cliente. 
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
            content = generate_content(row, pricing, product_knowledge)
            
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

