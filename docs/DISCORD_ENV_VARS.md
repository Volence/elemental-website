# Discord Integration - Environment Variables

Required environment variables for production deployment:

## Required Variables:

```bash
# Discord Bot Token (from Discord Developer Portal)
DISCORD_BOT_TOKEN=your_bot_token_here

# Discord Server (Guild) ID
DISCORD_GUILD_ID=your_server_id_here

# Discord Client ID (from Discord Developer Portal - Application ID)
DISCORD_CLIENT_ID=your_client_id_here

# Team Cards Channel ID (where team/staff cards are posted)
DISCORD_TEAM_CARDS_CHANNEL_ID=1457238873326489723

# Public server URL (for team card images to load in Discord)
NEXT_PUBLIC_SERVER_URL=https://elmt.gg
```

## How to Get These Values:

### DISCORD_BOT_TOKEN
1. Go to https://discord.com/developers/applications
2. Select your application
3. Go to "Bot" section
4. Click "Reset Token" and copy the token

### DISCORD_GUILD_ID
1. Enable Developer Mode in Discord (Settings → Advanced → Developer Mode)
2. Right-click your server icon → Copy Server ID

### DISCORD_CLIENT_ID
1. Go to https://discord.com/developers/applications
2. Select your application
3. Go to "General Information"
4. Copy the "Application ID"

### DISCORD_TEAM_CARDS_CHANNEL_ID
1. Enable Developer Mode in Discord
2. Right-click the #server-info channel → Copy Channel ID

## Where to Add:

**Production Server:**
```bash
# Add to: /path/to/elemental-website/.env
# Or: docker-compose.prod.yml environment section
```

**Testing:**
You can test with your test server:
- DISCORD_GUILD_ID=788140179248381993 (test server)
- Use a test channel ID for team cards

## Database Migration Required:

New table needed: `discord_category_templates`

The table will be auto-created by Payload on first run, but you can verify with:

```sql
-- Check if table exists
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_name = 'discord_category_templates'
);
```

No data will be lost - this only adds new tables, doesn't modify existing ones.
