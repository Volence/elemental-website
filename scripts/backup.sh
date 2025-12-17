#!/bin/bash
# Backup script for Elemental Website
# Run daily via cron: 0 2 * * * /opt/elemental-website/backup.sh >> /var/log/elemental-backup.log 2>&1

set -e

BACKUP_DIR="/opt/backups"
PROJECT_DIR="/opt/elemental-website"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

echo "Starting backup at $(date)"

# Backup database
echo "Backing up database..."
docker compose -f $PROJECT_DIR/docker-compose.prod.yml exec -T postgres pg_dump -U payload payload | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Backup uploads if they exist
if [ -d "$PROJECT_DIR/public/uploads" ]; then
    echo "Backing up uploads..."
    tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz -C $PROJECT_DIR public/uploads
fi

# Backup environment file (without sensitive data)
if [ -f "$PROJECT_DIR/.env.production" ]; then
    echo "Backing up environment file..."
    cp $PROJECT_DIR/.env.production $BACKUP_DIR/env_$DATE.backup
fi

# Keep only last 7 days of backups
echo "Cleaning up old backups..."
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
find $BACKUP_DIR -name "*.backup" -mtime +7 -delete

echo "Backup completed successfully at $(date)"
echo "Backup files:"
ls -lh $BACKUP_DIR | grep $DATE
