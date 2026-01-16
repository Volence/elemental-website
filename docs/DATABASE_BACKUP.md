# Database & Media Backup System

## Overview
Automated daily and hourly backups of the PostgreSQL database and media files to prevent data loss.

## Automated Backups

### Schedule
- **Hourly**: Database only, every hour on the hour
- **Daily at 2 AM**: Full backup (database + media volume)
- **Database Retention**: Last 30 days
- **Media Retention**: Last 7 days (larger files)

### Backup Location
All backups are stored in: `/home/ubuntu/backups/`

- Database: `payload_backup_YYYYMMDD_HHMMSS.sql.gz`
- Media: `media_backup_YYYYMMDD_HHMMSS.tar.gz`

### Backup Logs
Backup execution logs are stored in: `/home/ubuntu/backups/backup.log`

## Manual Backup

To create a manual backup immediately:

```bash
cd /home/ubuntu/elemental-website
./scripts/backup-database.sh
```

## Restore from Backup

### List Available Backups
```bash
ls -lh /home/ubuntu/backups/
```

### Restore a Backup
```bash
cd /home/ubuntu/elemental-website
./scripts/restore-database.sh /home/ubuntu/backups/payload_backup_YYYYMMDD_HHMMSS.sql.gz
```

**⚠️ WARNING**: This will completely replace your current database with the backup!

## Verify Backups

Check that backups are running:
```bash
crontab -l
tail -f /home/ubuntu/backups/backup.log
```

Verify a backup file:
```bash
gunzip -c /home/ubuntu/backups/payload_backup_YYYYMMDD_HHMMSS.sql.gz | head -50
```

## Download Backup to Local Machine

```bash
scp -i ~/.ssh/id_rsa ubuntu@elmt.gg:/home/ubuntu/backups/payload_backup_YYYYMMDD_HHMMSS.sql.gz ./
```

## Emergency Recovery

If the database is corrupted or lost:

1. Find the most recent backup:
   ```bash
   ls -lt /home/ubuntu/backups/ | head -5
   ```

2. Restore it:
   ```bash
   cd /home/ubuntu/elemental-website
   ./scripts/restore-database.sh /home/ubuntu/backups/[most-recent-backup].sql.gz
   ```

3. Verify data integrity:
   ```bash
   docker compose exec postgres psql -U payload -d payload -c "SELECT COUNT(*) FROM teams;"
   docker compose exec postgres psql -U payload -d payload -c "SELECT COUNT(*) FROM matches;"
   docker compose exec postgres psql -U payload -d payload -c "SELECT COUNT(*) FROM people;"
   ```

## Best Practices

1. **Test restores regularly** - Verify backups work by restoring to a local environment
2. **Download critical backups** - Keep local copies of important milestones
3. **Monitor backup logs** - Check `/home/ubuntu/backups/backup.log` weekly
4. **Before major changes** - Always create a manual backup first

## Backup System Maintenance

### Adjust Backup Schedule
Edit the crontab:
```bash
crontab -e
```

### Adjust Retention Period
Edit the backup script to change the 30-day retention:
```bash
nano /home/ubuntu/elemental-website/scripts/backup-database.sh
# Change the line: find $BACKUP_DIR -name "payload_backup_*.sql.gz" -mtime +30 -delete
```

### Check Disk Space
```bash
df -h /home/ubuntu/backups
du -sh /home/ubuntu/backups
```

## Troubleshooting

### Backup Failed
Check the logs:
```bash
tail -100 /home/ubuntu/backups/backup.log
```

### Cron Not Running
```bash
sudo systemctl status cron
sudo systemctl restart cron
```

### Permission Issues
```bash
sudo chmod +x /home/ubuntu/elemental-website/scripts/backup-database.sh
sudo chown ubuntu:ubuntu /home/ubuntu/backups/*
```

## December 27, 2025 - Incident

On this date, the production database was accidentally deleted during a configuration change. This backup system was immediately implemented to prevent future data loss. Going forward, **NEVER** delete the postgres_data volume without:

1. Creating a verified backup first
2. Getting explicit user confirmation
3. Testing the backup restoration process

**Lessons learned:**
- Always backup before making infrastructure changes
- Test disaster recovery procedures
- Maintain multiple backup copies (hourly + daily)
- Document all critical procedures

