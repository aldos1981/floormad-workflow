import sqlite3
import uuid

DB_NAME = "floormad.db"

def restore_agrilock():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()

    # Check if Agrilock exists
    existing = c.execute("SELECT id FROM projects WHERE name='Agrilock'").fetchone()
    
    if existing:
        print(f"Project 'Agrilock' already exists with ID: {existing[0]}")
    else:
        print("Restoring Agrilock Project...")
        project_id = str(uuid.uuid4())
        
        # Data from user context/history
        name = "Agrilock"
        sheet_id = "1_mJtzPvw2jUEP9bKqAEH9RyOGt-UHUNX6tTZ08--msE"
        
        # Get Service Account from settings if available
        sa_json = ""
        try:
            row = c.execute("SELECT value FROM settings WHERE key='service_account_json'").fetchone()
            if row:
                sa_json = row[0]
                print("Using Service Account from Global Settings.")
        except:
            pass
            
        if not sa_json:
            print("WARNING: No Service Account found in settings. Inserting placeholder.")
            sa_json = "{}"

        try:
            c.execute(
                "INSERT INTO projects (id, name, description, google_sheet_id, service_account_json, status) VALUES (?, ?, ?, ?, ?, ?)",
                (project_id, name, "Restored Project", sheet_id, sa_json, "active")
            )
            conn.commit()
            print(f"Successfully restored Agrilock with ID: {project_id}")
        except Exception as e:
            print(f"Error checking project: {e}")

    # Verify count
    count = c.execute("SELECT count(*) FROM projects").fetchone()[0]
    print(f"Total projects in DB: {count}")
    
    conn.close()

if __name__ == "__main__":
    restore_agrilock()
