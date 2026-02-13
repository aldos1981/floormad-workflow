import sqlite3
from database import DB_NAME

def migrate():
    print(f"Migrating {DB_NAME} to add price_list_cache...")
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    try:
        print("Adding column price_list_cache...")
        cursor.execute("ALTER TABLE projects ADD COLUMN price_list_cache TEXT")
        print("  Added price_list_cache")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e):
            print("  Column price_list_cache already exists.")
        else:
            print(f"  Error adding price_list_cache: {e}")
                
    conn.commit()
    conn.close()
    print("Migration complete.")

if __name__ == "__main__":
    migrate()
