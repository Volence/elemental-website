# Discord Integration - Deployment Checklist

## ✅ Pre-Deployment (COMPLETED)

- [x] All TypeScript errors fixed (`npm run type-check` passes)
- [x] Feature branch merged to main
- [x] Documentation created (DISCORD_INTEGRATION.md, DISCORD_ENV_VARS.md)

## 📝 Deployment Steps

### Step 1: Add Environment Variables to Production Server

Connect to production server and add these to `.env`:

```bash
# Discord Bot Configuration
DISCORD_BOT_TOKEN=<get_from_discord_dev_portal>
DISCORD_GUILD_ID=<your_production_server_id>
DISCORD_CLIENT_ID=<get_from_discord_dev_portal>

# Team Cards Channel
DISCORD_TEAM_CARDS_CHANNEL_ID=1457238873326489723

# Public URL (for images in Discord)
NEXT_PUBLIC_SERVER_URL=https://elmt.gg
```

**Where to get values:** See `docs/DISCORD_ENV_VARS.md`

### Step 2: Database Migration

Payload will auto-create new tables on startup:
- `discord_category_templates`
- `discord_server_manager` 
- `discord_polls` (for Phase 2)
- `cron_job_runs` (if not exists)

**No existing data will be modified or deleted.**

You can verify after deployment:
```sql
\dt discord*
```

### Step 3: Deploy to Production

```bash
# From your local machine
./scripts/deploy-to-server.sh
```

This will:
1. Pull latest code from main
2. Stop payload container
3. Rebuild with new code
4. Start payload container
5. Payload auto-migrates database on startup

### Step 4: Verify Discord Bot

After deployment, check:

1. **Bot is connected:**
   ```bash
   docker compose logs payload | grep "Discord bot ready"
   ```

2. **Slash commands registered:**
   - In Discord, type `/team` - should see 4 commands
   - `/team info`, `/team upcoming matches`, `/team match history`, `/team faceit`

3. **Team cards posted:**
   - Check #server-info channel (ID: 1457238873326489723)
   - Should show all teams and staff cards

4. **Discord Server Manager accessible:**
   - Login to admin panel: https://elmt.gg/admin
   - Look for "DISCORD" group in sidebar
   - Click "Discord Server Manager"
   - Should see Server Structure, Statistics, Health Check, Templates tabs

### Step 5: Manual Refresh (if needed)

If team cards didn't post automatically:

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"refreshAll": true}' \
  https://elmt.gg/api/discord/team-cards
```

## 🔍 Troubleshooting

### Bot not connecting:
- Check `DISCORD_BOT_TOKEN` is correct
- Check `DISCORD_GUILD_ID` matches your server
- Check logs: `docker compose logs -f payload`

### Slash commands not showing:
- Wait 5-10 minutes (Discord caches commands)
- Verify `DISCORD_CLIENT_ID` is correct
- Check bot has `applications.commands` scope

### Images not loading in Discord:
- Verify `NEXT_PUBLIC_SERVER_URL=https://elmt.gg`
- Check team logos are uploaded and public
- Test URL directly: https://elmt.gg/media/[logo-filename]

### Team cards not posting:
- Check `DISCORD_TEAM_CARDS_CHANNEL_ID` is correct
- Verify bot has permissions in that channel:
  - Send Messages
  - Embed Links
  - Manage Messages

## 📚 Documentation

- **Full Integration Guide:** `docs/DISCORD_INTEGRATION.md`
- **Environment Variables:** `docs/DISCORD_ENV_VARS.md`
- **API Reference:** See DISCORD_INTEGRATION.md "API Reference" section

## 🎉 Success Criteria

Deployment is successful when:
- [  ] Bot shows as online in Discord server
- [  ] `/team` commands work in Discord
- [  ] Team/staff cards visible in #server-info
- [  ] Discord Server Manager accessible in admin panel
- [  ] No errors in `docker compose logs`

## 🔄 Rollback (if needed)

```bash
git revert HEAD
./scripts/deploy-to-server.sh
```

Database tables will remain but won't be used. No data loss.
