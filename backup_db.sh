#!/bin/bash
# Floormad Auto-Backup Script
# Downloads a full JSON backup from the Railway app to Dropbox
# 
# Setup: Run this to schedule daily backups at 2 AM:
#   chmod +x backup_db.sh
#   crontab -e
#   Add: 0 2 * * * /Volumes/Lavori\ Dropbox/Dropbox/Github\ Aldos\ Plugins/0\)\ Floormad\ Workflow\ N8N\ Definitiva\ PYTHON\ MOD/backup_db.sh

APP_URL="https://floormad-workflow-production.up.railway.app"
BACKUP_DIR="/Volumes/Lavori Dropbox/Dropbox/Github Aldos Plugins/0) Floormad Workflow N8N Definitiva PYTHON MOD/backups"
DATE=$(date +%Y%m%d_%H%M%S)
KEEP_DAYS=30

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Download backup
echo "🔄 Downloading backup from $APP_URL..."
curl -s "$APP_URL/api/backup" -o "$BACKUP_DIR/backup_$DATE.json"

# Check if successful
if [ -s "$BACKUP_DIR/backup_$DATE.json" ]; then
    echo "✅ Backup saved: backup_$DATE.json"
    
    # Count projects in backup
    PROJECTS=$(python3 -c "import json; d=json.load(open('$BACKUP_DIR/backup_$DATE.json')); print(len(d.get('projects',[])))" 2>/dev/null)
    echo "   📦 Projects: $PROJECTS"
    
    # Cleanup old backups (keep last 30 days)
    find "$BACKUP_DIR" -name "backup_*.json" -mtime +$KEEP_DAYS -delete
    echo "   🗑️  Old backups cleaned (keeping last $KEEP_DAYS days)"
else
    echo "❌ Backup failed!"
    rm -f "$BACKUP_DIR/backup_$DATE.json"
fi
