#!/bin/bash
# Restore PostgreSQL database from backup

if [ -z "$1" ]; then
    echo "Usage: ./restore-database.sh <backup_file.sql.gz>"
    echo ""
    echo "Available backups:"
    ls -lh /home/ubuntu/backups/*.sql.gz 2>/dev/null | tail -10
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "Error: Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "⚠️  WARNING: This will DROP the existing database and restore from backup!"
echo "Backup file: $BACKUP_FILE"
echo ""
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Restore cancelled."
    exit 0
fi

echo "Restoring database..."

# Drop and recreate database
docker compose exec -T postgres psql -U payload -c "DROP DATABASE IF EXISTS payload;"
docker compose exec -T postgres psql -U payload -c "CREATE DATABASE payload;"

# Restore from backup
gunzip -c "$BACKUP_FILE" | docker compose exec -T postgres psql -U payload -d payload

echo "✅ Database restored successfully from: $BACKUP_FILE"
