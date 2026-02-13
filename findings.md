# Findings & Constraints

## Integrations
- **WeSendit**: Selected provider for WhatsApp and general messaging channels. Docs/API verification needed in Phase 2.
- **Google Sheets**: Source of Truth & State Manager.
- **SMTP**: Standard email delivery.

## Logic Constraints
- **Pricing**: Must be deterministic.
- **Lead Status**: Critical for idempotency. Only process "New" leads.

## Infrastructure
- **Server**: Single-User Web Server.
- **Framework**: FastAPI or Streamlit (TBD during Phase 3).
- **Automation**: Cron job (5-minute interval).
- **Security**: Basic Authentication required.
