import os
import json
import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any

DATABASE_URL = os.environ.get("DATABASE_URL")

# --- Dual-Mode: PostgreSQL (Railway) or SQLite (local dev) ---

if DATABASE_URL:
    import psycopg2
    from psycopg2.extras import RealDictCursor

    class PgConnectionWrapper:
        """Wraps psycopg2 connection to provide SQLite-compatible interface.
        
        This allows existing code using conn.execute(..., (params,)) with ? placeholders
        to work transparently with PostgreSQL's %s placeholders.
        """
        def __init__(self, conn):
            self._conn = conn
            
        def execute(self, query, params=None):
            # Convert ? placeholders to %s for PostgreSQL
            query = query.replace("?", "%s")
            # Convert INSERT OR REPLACE to PostgreSQL ON CONFLICT (for settings table)
            if "INSERT OR REPLACE INTO settings" in query:
                query = "INSERT INTO settings (key, value) VALUES (%s, %s) ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value"
            cur = self._conn.cursor(cursor_factory=RealDictCursor)
            cur.execute(query, params)
            return PgCursorWrapper(cur)
        
        def commit(self):
            self._conn.commit()
            
        def close(self):
            self._conn.close()
            
        def cursor(self):
            return self._conn.cursor(cursor_factory=RealDictCursor)

    class PgCursorWrapper:
        """Wraps psycopg2 cursor to return dict-like rows compatible with sqlite3.Row."""
        def __init__(self, cursor):
            self._cursor = cursor
            
        def fetchone(self):
            row = self._cursor.fetchone()
            if row is None:
                return None
            return DictRow(row)
        
        def fetchall(self):
            rows = self._cursor.fetchall()
            return [DictRow(r) for r in rows]
        
        def __getitem__(self, idx):
            """Support cursor[0] for COUNT(*) etc."""
            row = self._cursor.fetchone()
            if row is None:
                return None
            values = list(row.values())
            return values[idx]

    class DictRow(dict):
        """Dict subclass that also supports integer indexing like sqlite3.Row."""
        def __init__(self, data):
            super().__init__(data)
            self._values = list(data.values())
            
        def __getitem__(self, key):
            if isinstance(key, int):
                return self._values[key]
            return super().__getitem__(key)

    def get_db_connection():
        conn = psycopg2.connect(DATABASE_URL)
        return PgConnectionWrapper(conn)

else:
    import sqlite3

    DB_NAME = "floormad.db"

    def get_db_connection():
        conn = sqlite3.connect(DB_NAME)
        conn.row_factory = sqlite3.Row
        return conn


def init_db():
    conn = get_db_connection()
    
    if DATABASE_URL:
        cur = conn.cursor()
        
        # Projects Table
        cur.execute('''
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                status TEXT DEFAULT 'active',
                google_sheet_id TEXT NOT NULL DEFAULT '',
                service_account_json TEXT NOT NULL DEFAULT '',
                smtp_config TEXT,
                wesendit_config TEXT,
                cron_expression TEXT,
                price_list_url TEXT,
                locality_prompt TEXT,
                products_config TEXT,
                workflow_json TEXT,
                oauth_credentials TEXT,
                pipedrive_config TEXT,
                price_list_cache TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            )
        ''')
        
        # Add columns if missing (PostgreSQL style)
        for col, col_type in [
            ('workflow_json', 'TEXT'),
            ('oauth_credentials', 'TEXT'),
            ('pipedrive_config', 'TEXT'),
            ('price_list_cache', 'TEXT'),
        ]:
            cur.execute(f"""
                DO $$ BEGIN
                    ALTER TABLE projects ADD COLUMN {col} {col_type};
                EXCEPTION WHEN duplicate_column THEN NULL;
                END $$;
            """)
        
        # Runs Table
        cur.execute('''
            CREATE TABLE IF NOT EXISTS runs (
                id TEXT PRIMARY KEY,
                project_id TEXT,
                timestamp TIMESTAMP DEFAULT NOW(),
                leads_processed INTEGER DEFAULT 0,
                status TEXT,
                log_details TEXT,
                output_json TEXT,
                FOREIGN KEY(project_id) REFERENCES projects(id)
            )
        ''')
        
        cur.execute("""
            DO $$ BEGIN
                ALTER TABLE runs ADD COLUMN output_json TEXT;
            EXCEPTION WHEN duplicate_column THEN NULL;
            END $$;
        """)
        
        # Settings Table
        cur.execute('''
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT
            )
        ''')

        # Workflow Versions Table
        cur.execute('''
            CREATE TABLE IF NOT EXISTS workflow_versions (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                workflow_json TEXT NOT NULL,
                label TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                FOREIGN KEY(project_id) REFERENCES projects(id)
            )
        ''')
        
        conn.commit()
        conn.close()
    else:
        # SQLite mode — original logic
        c = conn.cursor()
        
        c.execute('''
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                status TEXT DEFAULT 'active',
                google_sheet_id TEXT NOT NULL,
                service_account_json TEXT NOT NULL,
                smtp_config JSON,
                wesendit_config JSON,
                cron_expression TEXT,
                price_list_url TEXT,
                locality_prompt TEXT,
                products_config JSON,
                workflow_json TEXT,
                oauth_credentials JSON,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        import sqlite3 as _sqlite3
        for col, col_type in [
            ('workflow_json', 'TEXT'),
            ('oauth_credentials', 'JSON'),
            ('pipedrive_config', 'JSON'),
            ('price_list_cache', 'TEXT'),
        ]:
            try:
                c.execute(f"ALTER TABLE projects ADD COLUMN {col} {col_type}")
            except _sqlite3.OperationalError:
                pass
        
        c.execute('''
            CREATE TABLE IF NOT EXISTS runs (
                id TEXT PRIMARY KEY,
                project_id TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                leads_processed INTEGER DEFAULT 0,
                status TEXT,
                log_details TEXT,
                FOREIGN KEY(project_id) REFERENCES projects(id)
            )
        ''')
        
        try:
            c.execute("ALTER TABLE runs ADD COLUMN output_json TEXT")
        except _sqlite3.OperationalError:
            pass
        
        c.execute('''
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT
            )
        ''')

        c.execute('''
            CREATE TABLE IF NOT EXISTS workflow_versions (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                workflow_json TEXT NOT NULL,
                label TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(project_id) REFERENCES projects(id)
            )
        ''')
        
        conn.commit()
        conn.close()
    
    print(f"Database initialized ({'PostgreSQL' if DATABASE_URL else 'SQLite'}).")

if __name__ == "__main__":
    init_db()
