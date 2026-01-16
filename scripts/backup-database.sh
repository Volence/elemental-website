#!/bin/bash
# Automated PostgreSQL + Media backup script

BACKUP_DIR="/home/ubuntu/backups"
PROJECT_DIR="/home/ubuntu/elemental-website"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/payload_backup_$DATE.sql"

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

echo "[$DATE] Starting backup..."

# Database backup
echo "  Backing up database..."
docker compose -f $PROJECT_DIR/docker-compose.prod.yml exec -T postgres pg_dump -U payload payload > $BACKUP_FILE

# Compress database backup
gzip $BACKUP_FILE
echo "  Database backup: ${BACKUP_FILE}.gz"

# Media volume backup (only once daily at 2 AM to save space)
HOUR=$(date +%H)
if [ "$HOUR" = "02" ]; then
    echo "  Backing up media volume..."
    MEDIA_BACKUP="$BACKUP_DIR/media_backup_$DATE.tar.gz"
    
    # Get the media volume name
    VOLUME_NAME=$(docker volume ls --format '{{.Name}}' | grep -E 'elemental.*media' | head -1)
    
    if [ -n "$VOLUME_NAME" ]; then
        # Create temporary container to access volume and tar its contents
        docker run --rm \
            -v "$VOLUME_NAME:/data:ro" \
            -v "$BACKUP_DIR:/backup" \
            alpine tar czf "/backup/media_backup_$DATE.tar.gz" -C /data .
        echo "  Media backup: $MEDIA_BACKUP"
    else
        echo "  Warning: Media volume not found, skipping media backup"
    fi
    
    # Keep only last 7 days of media backups (larger files)
    find $BACKUP_DIR -name "media_backup_*.tar.gz" -mtime +7 -delete
fi

# Keep only last 30 days of database backups
find $BACKUP_DIR -name "payload_backup_*.sql.gz" -mtime +30 -delete

echo "[$DATE] Backup completed successfully"

