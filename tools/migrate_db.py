import sqlite3
from database import DB_NAME

def migrate():
    print(f"Migrating {DB_NAME}...")
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    columns_to_add = [
        ("cron_expression", "TEXT"),
        ("price_list_url", "TEXT"),
        ("locality_prompt", "TEXT"),
        ("products_config", "TEXT") # JSON stored as TEXT
    ]
    
    for col_name, col_type in columns_to_add:
        try:
            print(f"Adding column {col_name}...")
            cursor.execute(f"ALTER TABLE projects ADD COLUMN {col_name} {col_type}")
            print(f"  Added {col_name}")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e):
                print(f"  Column {col_name} already exists.")
            else:
                print(f"  Error adding {col_name}: {e}")
                
    conn.commit()
    conn.close()
    print("Migration complete.")

if __name__ == "__main__":
    migrate()
