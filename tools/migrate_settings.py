import sqlite3

def migrate():
    conn = sqlite3.connect('floormad.db')
    cursor = conn.cursor()
    
    # Create Settings Table
    # Key-Value store for global configs
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
    )
    ''')
    
    conn.commit()
    conn.close()
    print("Migration successful: Added settings table.")

if __name__ == "__main__":
    migrate()
