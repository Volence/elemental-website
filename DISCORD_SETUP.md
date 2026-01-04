# Discord Bot Setup

## Phase 1: Infrastructure Complete ✅

The Discord bot infrastructure has been set up. To enable it, add the following environment variables to your `.env` file.

## Required Environment Variables

Copy the bot credentials from `~/elemental/discord-manager/server/.env`:

```env
# Discord Bot Configuration (Required)
DISCORD_BOT_TOKEN=<copy from discord-manager>
DISCORD_CLIENT_ID=<copy from discord-manager>

# Test Server (for development)
DISCORD_GUILD_ID=788140179248381993

# When ready for production, switch to your production server:
# DISCORD_GUILD_ID=<your_production_server_id>
```

## Optional Environment Variables

```env
# Discord Cards Channel (both staff and teams)
DISCORD_CARDS_CHANNEL=1457238873326489723

# Public Server URL (REQUIRED for team logos in Discord embeds)
NEXT_PUBLIC_SERVER_URL=https://your-production-domain.com
```

**Important**: Team logos in Discord embeds require `NEXT_PUBLIC_SERVER_URL` to be set to a **publicly accessible URL**. Local development URLs (localhost) will not work in Discord as Discord servers cannot access localhost.

## How to Get Values

### From discord-manager Bot
```bash
# View discord-manager credentials:
cat ~/elemental/discord-manager/server/.env
```

You need:
- `DISCORD_TOKEN` → Copy to `DISCORD_BOT_TOKEN`
- `CLIENT_ID` → Copy to `DISCORD_CLIENT_ID`

### Discord Channel IDs
1. Enable Developer Mode in Discord:
   - User Settings → Advanced → Developer Mode (toggle on)
2. Right-click any channel → Copy Channel ID

## Testing the Bot

1. Add the environment variables to your `.env` file
2. Start the Next.js dev server:
   ```bash
   npm run dev
   ```
3. Look for these log messages:
   ```
   🤖 Initializing Discord bot...
   ✅ Discord bot ready! Logged in as <Bot Name>#1234
   🔄 Registering 2 slash commands...
   ✅ Successfully registered 2 slash commands
   🔗 Discord bot connected to server
   ✅ Discord bot fully initialized
   ```

4. In your Discord test server, type `/` and you should see:
   - `/team` - Team information commands (placeholder)
   - `/schedulepoll` - Create availability poll (placeholder)

## Current Status

✅ **Phase 1 Complete**: Infrastructure Setup
- Bot client initialization
- Slash command registration
- Interaction handlers (placeholders)
- Server startup integration

🚧 **Coming Next**:
- Phase 2: Team cards with auto-update
- Phase 3: Team lookup commands (/team info, matches, history, faceit)
- Phase 4: Poll & schedule system
- Phase 5: Server manager (admin only)

## Troubleshooting

### Bot doesn't start
- Check that all environment variables are set correctly
- Verify the bot token is valid
- Check the server logs for error messages

### Commands don't appear in Discord
- Commands are guild-specific (faster registration)
- Make sure `DISCORD_GUILD_ID` matches your test server
- Try restarting the dev server

### Permission errors
- Bot needs these permissions in your Discord server:
  - Send Messages
  - Embed Links
  - Use Slash Commands
  - Read Message History (for polls)
