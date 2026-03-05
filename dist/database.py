import sqlite3
from typing import List, Optional, Dict, Any
import json
import uuid
from datetime import datetime

DB_NAME = "floormad.db"

def get_db_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    c = conn.cursor()
    
    # Projects Table
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
    
    # Migration: Add workflow_json if missing
    try:
        c.execute("ALTER TABLE projects ADD COLUMN workflow_json TEXT")
    except sqlite3.OperationalError:
        pass # Column likely already exists

    # Migration: Add oauth_credentials if missing
    try:
        c.execute("ALTER TABLE projects ADD COLUMN oauth_credentials JSON")
    except sqlite3.OperationalError:
        pass # Column likely already exists

    # Migration: Add pipedrive_config if missing
    try:
        c.execute("ALTER TABLE projects ADD COLUMN pipedrive_config JSON")
    except sqlite3.OperationalError:
        pass # Column likely already exists
    
    # Runs Table
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
    
    # Migration: Add output_json to runs if missing
    try:
        c.execute("ALTER TABLE runs ADD COLUMN output_json TEXT")
    except sqlite3.OperationalError:
        pass # Column likely already exists
    
    # Settings Table
    c.execute('''
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    ''')

    # Workflow Versions Table (Backup & Restore)
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
    print(f"Database {DB_NAME} initialized.")

if __name__ == "__main__":
    init_db()
