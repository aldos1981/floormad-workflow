"""
Migration script: SQLite → PostgreSQL
Reads all data from local floormad.db and inserts into Railway PostgreSQL.

Usage:
    DATABASE_URL="postgresql://..." python3 migrate_to_pg.py
"""
import sqlite3
import os
import sys
import json

DATABASE_URL = os.environ.get("DATABASE_URL")

if not DATABASE_URL:
    print("❌ ERROR: Set DATABASE_URL environment variable first!")
    print('Usage: DATABASE_URL="postgresql://user:pass@host:port/db" python3 migrate_to_pg.py')
    sys.exit(1)

import psycopg2
from psycopg2.extras import RealDictCursor

# --- Connect to both databases ---
print("📂 Connecting to local SQLite (floormad.db)...")
sq = sqlite3.connect("floormad.db")
sq.row_factory = sqlite3.Row

print(f"🐘 Connecting to PostgreSQL...")
pg = psycopg2.connect(DATABASE_URL)
cur = pg.cursor()

# --- 1. Create tables (init_db equivalent) ---
print("\n🔧 Creating tables...")
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
cur.execute('''
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
    )
''')
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
pg.commit()
print("   ✅ Tables created")

# --- 2. Migrate Settings ---
print("\n📋 Migrating settings...")
settings = sq.execute("SELECT key, value FROM settings").fetchall()
for s in settings:
    cur.execute(
        "INSERT INTO settings (key, value) VALUES (%s, %s) ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value",
        (s['key'], s['value'])
    )
    print(f"   ✅ {s['key']}")
pg.commit()

# --- 3. Migrate Projects ---
print("\n📦 Migrating projects...")
projects = sq.execute("SELECT * FROM projects").fetchall()

# Get column names from SQLite
sq_cols = [desc[0] for desc in sq.execute("PRAGMA table_info(projects)").fetchall()]
sq_col_names = [row[1] for row in sq.execute("PRAGMA table_info(projects)").fetchall()]

for p in projects:
    p_dict = dict(p)
    
    # Columns that exist in both SQLite and PostgreSQL
    pg_columns = ['id', 'name', 'description', 'status', 'google_sheet_id', 'service_account_json',
                  'smtp_config', 'wesendit_config', 'cron_expression', 'price_list_url', 
                  'locality_prompt', 'products_config', 'workflow_json', 'oauth_credentials',
                  'pipedrive_config', 'price_list_cache', 'created_at']
    
    cols = []
    vals = []
    for col in pg_columns:
        if col in p_dict:
            cols.append(col)
            vals.append(p_dict[col] if p_dict[col] is not None else ('' if col in ('google_sheet_id', 'service_account_json') else None))
    
    placeholders = ', '.join(['%s'] * len(cols))
    col_str = ', '.join(cols)
    
    cur.execute(
        f"INSERT INTO projects ({col_str}) VALUES ({placeholders}) ON CONFLICT(id) DO NOTHING",
        tuple(vals)
    )
    print(f"   ✅ {p_dict['name']} ({p_dict['id'][:8]}...)")

pg.commit()

# --- 4. Migrate Runs ---
print("\n🏃 Migrating runs...")
runs = sq.execute("SELECT * FROM runs").fetchall()
for r in runs:
    r_dict = dict(r)
    cur.execute(
        "INSERT INTO runs (id, project_id, timestamp, leads_processed, status, log_details) VALUES (%s, %s, %s, %s, %s, %s) ON CONFLICT(id) DO NOTHING",
        (r_dict['id'], r_dict['project_id'], r_dict.get('timestamp'), r_dict.get('leads_processed', 0), 
         r_dict.get('status'), r_dict.get('log_details'))
    )
print(f"   ✅ {len(runs)} runs migrated")
pg.commit()

# --- 5. Migrate Workflow Versions ---
print("\n📜 Migrating workflow versions...")
try:
    versions = sq.execute("SELECT * FROM workflow_versions").fetchall()
    for v in versions:
        v_dict = dict(v)
        cur.execute(
            "INSERT INTO workflow_versions (id, project_id, workflow_json, label, created_at) VALUES (%s, %s, %s, %s, %s) ON CONFLICT(id) DO NOTHING",
            (v_dict['id'], v_dict['project_id'], v_dict['workflow_json'], v_dict.get('label'), v_dict.get('created_at'))
        )
    print(f"   ✅ {len(versions)} versions migrated")
except Exception as e:
    print(f"   ⚠️ Skipped: {e}")
pg.commit()

# --- Done ---
sq.close()
pg.close()
print("\n🎉 Migration complete! All data transferred to PostgreSQL.")
