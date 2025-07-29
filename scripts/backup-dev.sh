#!/bin/bash
set -e

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="./backups/dev"
BACKUP_FILE="${BACKUP_DIR}/yarn_crafting_dev_${TIMESTAMP}.sql"

echo "📦 Creating development database backup..."

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Create backup
docker-compose -f docker-compose.dev.yml exec -T postgres pg_dump \
    -U postgres \
    -d yarn_crafting_dev \
    -c --if-exists \
    > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "✅ Backup created: $BACKUP_FILE"
    
    # Compress backup
    gzip "$BACKUP_FILE"
    echo "✅ Backup compressed: ${BACKUP_FILE}.gz"
    
    # Cleanup old backups (keep last 5)
    find "$BACKUP_DIR" -name "yarn_crafting_dev_*.sql.gz" -type f | sort -r | tail -n +6 | xargs rm -f
    echo "🧹 Cleaned up old backups"
else
    echo "❌ Backup failed"
    exit 1
fi
