# Database Recovery Guide

## What Happened

The `docker compose down -v` command deleted the database volumes. All data was lost, but we can recreate everything.

## Good News

✅ **MongoDB ObjectId errors are GONE** (cache was cleared)  
✅ **Schema will auto-recreate** (Payload will set everything up)  
✅ **All your UI improvements are intact**  

## Recovery Steps

### Step 1: Run the Initial Schema Migration

We have a complete baseline migration that creates all tables:

```bash
cd ~/elemental-website
docker compose -f docker-compose.prod.yml exec -T postgres psql -U payload -d payload < migrations/001_initial_schema.sql
```

This will create all tables, indexes, and relationships in one go.

### Step 2: Create Your First Admin User

1. Visit: `https://elmt.gg/admin`
2. You'll see the "Create First User" screen
3. Fill in:
   - **Name**: Malevolence (or your name)
   - **Email**: steve@volence.dev
   - **Password**: (your password)
4. Click "Create"

The first user is automatically assigned Admin role!

### Step 3: Re-enter Your Data

You'll need to manually re-create:
- ✅ **People** - All your players/staff/casters
- ✅ **Teams** - All your teams
- ✅ **Production Staff** - Casters, observers, producers  
- ✅ **Matches** - Your match schedule
- ✅ **Pages** - Any custom pages you had
- ⚠️ **Users** - Other admin/manager users

## What You WON'T Need to Do

- ❌ Run SQL migrations (schema auto-creates)
- ❌ Fix MongoDB ObjectIds (problem is gone!)
- ❌ Fix column names (fresh schema is correct)

## Future: Set Up Backups

To prevent this in the future, create regular backups:

```bash
# Create backup script
cat > ~/backup-database.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="$HOME/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR"

docker compose -f ~/elemental-website/docker-compose.prod.yml exec -T postgres \
  pg_dump -U payload payload > "$BACKUP_DIR/payload_$TIMESTAMP.sql"

echo "Backup created: $BACKUP_DIR/payload_$TIMESTAMP.sql"

# Keep only last 7 days of backups
find "$BACKUP_DIR" -name "payload_*.sql" -mtime +7 -delete
EOF

chmod +x ~/backup-database.sh

# Add to crontab (daily at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * ~/backup-database.sh") | crontab -
```

## Summary

1. ✅ Add `PAYLOAD_DB_PUSH=true` to `.env.production`
2. ✅ Restart Payload
3. ✅ Visit `/admin` and create first user
4. ✅ Remove `PAYLOAD_DB_PUSH=true` and restart
5. ✅ Re-enter your data
6. ✅ Set up automatic backups

**The site will work perfectly after this!** 🎉
