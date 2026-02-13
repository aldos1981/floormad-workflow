# Task Plan: Floormad Automation Manager

## Phase 1: B - Blueprint (Vision & Logic)
- [x] **Discovery**: Pivot to Multi-Project Manager.
- [x] **Data-First**: Define SQLite Schema in `gemini.md`.

## Phase 2: A - Architect (The Engine)
- [ ] **Infrastructure**: Initialize FastAPI + SQLite (Tortoise/SQLAlchemy).
- [ ] **Database**: Create `projects` and `runs` tables.
- [ ] **API**: Build Endpoints (GET/POST /projects, POST /test-connection).

## Phase 3: E - Engine (Workflow Logic)
- [ ] **Step 1: Ingestion**: `fetch_pending_requests` (Filter Sheet Rows).
- [ ] **Step 2: Normalization**: `normalize_locality` (AI Prompt Implementation).
- [ ] **Step 3: Pricing**: `calculate_pricing` (JS Logic -> Python port).
- [ ] **Step 4: Content**: `generate_content` (AI Email/WhatsApp generation).
- [ ] **Step 5: Master Control**: `process_project_workflow` main loop.
- [ ] **Scheduler**: Background cron runner.

## Phase 4: S - Stylize (The Dashboard)
- [ ] **Frontend**: Build "Wow" UI (HTML/Tailwind/JS) for Project Management.
- [ ] **Settings Page**: Form to input Google Credentials, Sheet ID, **Price List URL**, **Cron Schedule**.
- [ ] **Dashboard**: View list of projects and their statuses.

## Phase 4: L - Link (Connectivity)
- [ ] **Dynamic Verification**: Test connection *per project* via UI button.
- [ ] **Runner**: Implement background job to loop through DB projects.

## Phase 5: T - Trigger (Deployment)
- [ ] **Dockerize**: specific container for easy deployment?
- [ ] **Final Polish**: Logs and history view.
