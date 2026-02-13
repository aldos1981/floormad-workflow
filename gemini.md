# Project Constitution: Floormad Automation Manager

## 1. Discovery
- **North Star**: A Web Dashboard to manage multiple Automation Projects. Each Project has its own Google Sheet, Credentials, and Configuration.
- **Infrastructure**: FastAPI (Backend) + SQLite (Database) + HTML/CSS/JS (Frontend).
- **Integrations**: 
  - Google Sheets API (Per Project)
  - WeSendit/SMTP (Per Project or Global? Assuming Per Project for now).
- **Execution Mode**: Background Scheduler handling multiple projects.

## 2. Data Schema

### 2.1. System Database (SQLite)

#### Table: `projects`
Stores configuration for each distinct automation workflow.
```sql
CREATE TABLE projects (
    id TEXT PRIMARY KEY, -- UUID
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'active', -- active, paused
    
    -- Google Credentials
    google_sheet_id TEXT NOT NULL,
    service_account_json TEXT NOT NULL, -- Encrypted or Path to file
    
    -- Notification Settings
    smtp_config JSON, -- {host, port, user, pass, from, to}
    smtp_config JSON, -- {host, port, user, pass, from, to}
    wesendit_config JSON, -- {api_key, token}

    -- Workflow Configuration
    cron_expression TEXT, -- e.g. "*/10 * * * *"
    price_list_url TEXT, -- URL to Google Sheet with prices
    locality_prompt TEXT, -- Custom prompt for AI locality detection
    
    -- Products / Knowledge Base
    products_config JSON, -- List of products [{id, name, knowledge_source_url, descriptions[]}]


    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### Table: `runs`
Log of executions for each project.
```sql
CREATE TABLE runs (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    timestamp DATETIME,
    leads_processed INTEGER,
    status TEXT, -- success, error
    log_details TEXT,
    FOREIGN KEY(project_id) REFERENCES projects(id)
);
```

### 2.2. Input/Output Schemas (Per Project)
*Remains the same as previous version (Lead Object, Calculation Result), but scoped to the specific Project being executed.*

## 3. Behavioral Rules
- **Isolation**: One project's failure must not stop others.
- **Security**: Sensitive data (JSON keys, passwords) must be stored securely.
- **CRUD UI**: User must be able to Create, Read, Update, Delete projects from the UI.

## 4. Architectural Invariants
1.  **Multi-Tenancy**: The runner iterates through *active* projects in the DB.
2.  **Dashboard First**: Configuration happens in UI, not code/env (except for the master App config).
