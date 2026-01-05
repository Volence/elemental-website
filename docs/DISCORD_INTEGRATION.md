# Discord Integration Guide

**Status:** ✅ Production Ready (Phase 1)  
**Date:** January 5, 2026  
**Branch:** `feature/discord-integration`

This document covers the Discord bot integration with the Elemental admin panel, including team cards, lookup commands, and server management tools.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Discord Bot Setup](#discord-bot-setup)
- [Usage Guide](#usage-guide)
- [Troubleshooting](#troubleshooting)
- [Future Enhancements](#future-enhancements)

---

## Overview

The Discord integration consolidates multiple bot functionalities into a single system integrated with the Payload CMS admin panel. It replaces the standalone `discord-bot` and `discord-manager` bots with a unified solution.

### What's Included (Phase 1):

1. **Team Cards System** - Auto-posting team/staff info to Discord
2. **Team Lookup Commands** - Public slash commands for team information
3. **Discord Server Manager** - Admin tools for channel/category management

### What's Coming (Phase 2):

- Poll creation and tracking system
- Visual schedule builder

---

## Features

### 1. Team Cards System

**Location:** `#server-info` channel (ID: `1457238873326489723`)

**What it does:**
- Displays all teams and staff as rich Discord embeds
- Auto-updates when rosters, logos, or SR changes
- Sorted by region → division → SR
- Full refresh on new team creation

**Staff Cards:**
- Grouped by department (Casters, Observers, Production, etc.)
- Shows role colors matching the website
- Lists all staff members by name

**Team Cards:**
- Shows team logo, name, SR, division, region
- Lists roster, subs, coaches, manager
- Clickable link to team page on website
- Color-coded by region (green for NA, purple for EMEA, orange for SA)

**Triggers:**
- Creating/updating/deleting teams in admin panel
- Changing roster, subs, manager, coaches
- Updating team logo or competitive rating
- Manual refresh via API: `POST /api/discord/team-cards` with `{"refreshAll": true}`

---

### 2. Team Lookup Commands

Public slash commands anyone in the Discord server can use:

#### `/team info [team-name]`
Shows team overview with logo, SR, roster, coaches, manager, achievements.

#### `/team upcoming matches [team-name]`
Lists next 5 upcoming matches with:
- Date/time
- Opponent
- Match type (FACEIT, Tournament, Scrim)
- Lobby link (if available)

#### `/team match history [team-name]`
Shows last 10 matches with:
- Date
- Opponent
- Result (Won/Lost)
- VOD link (if available)
- Lobby link (if available)
- Overall record at top

#### `/team faceit [team-name]`
Displays current FaceIt season stats:
- League/division
- Current record (W-L)
- Rank in division
- Points

---

### 3. Discord Server Manager

**Location:** `/admin/globals/discord-server-manager` (Admin-only)

Comprehensive Discord server management interface with 4 tabs:

#### **Server Structure**
- View entire server layout (categories + channels)
- Create, rename, delete, clone channels/categories
- Move/reorder via drag-and-drop
- Copy IDs for reference

**Channel Types Supported:**
- Text channels
- Voice channels
- Forum channels
- Categories

#### **Templates**
- Save category structures as reusable templates
- Edit templates (roles, permissions, channels)
- Apply templates with customization before creation
- Customize channel names, remove unwanted channels
- Set default permissions per role

**Template Features:**
- 19 common Discord permissions per role
- Searchable role dropdown (100+ roles supported)
- Drag-and-drop channel reordering
- Channel type selection (text/voice/forum)
- Visual channel type indicators

#### **Statistics**
- Channel counts (text, voice, announcement, categories)
- Role count (excluding @everyone and bot roles)
- Member stats (total, humans, bots, online)
- Server info (creation date, boost level, boost count)

#### **Health Check**
Six automated checks with actionable suggestions:

1. **Uncategorized Channels** - Channels not in any category (warning if 5+)
2. **Empty Categories** - Categories with no channels (info)
3. **Too Many Roles** - Custom roles approaching limit (warning if 100+)
4. **Dangerous Permissions** - Roles with admin/management perms (warning if 5+)
5. **Channel Limits** - Total channels approaching 500 limit (error if 450+)
6. **Members Without Roles** - Members with only @everyone role (info)

**Health Score:**
- 100 = Excellent (no issues)
- 90-99 = Good (minor info items)
- 70-89 = Fair (some warnings)
- <70 = Poor (errors or many warnings)

---

## Environment Variables

### Required Variables:

```bash
# Discord Bot Configuration
DISCORD_BOT_TOKEN=your_bot_token_here
DISCORD_GUILD_ID=your_server_id_here

# Team Cards Channel
DISCORD_TEAM_CARDS_CHANNEL_ID=1457238873326489723

# Next.js Public URL (for team card images)
NEXT_PUBLIC_SERVER_URL=https://elmt.gg
```

### Where to Add:

**Local Development:** `.env.local`
```bash
DISCORD_BOT_TOKEN=...
DISCORD_GUILD_ID=788140179248381993  # Test server
DISCORD_TEAM_CARDS_CHANNEL_ID=1457276379140849756
NEXT_PUBLIC_SERVER_URL=http://localhost:3000
```

**Production:** Server environment or `.env` file
```bash
DISCORD_BOT_TOKEN=...
DISCORD_GUILD_ID=your_production_server_id
DISCORD_TEAM_CARDS_CHANNEL_ID=1457238873326489723
NEXT_PUBLIC_SERVER_URL=https://elmt.gg
```

---

## Database Setup

### New Tables/Columns:

The Discord integration uses existing Payload collections. Ensure these exist:

1. **`teams`** - Team data (existing)
   - Added field: `discordCardMessageId` (text, optional)
   - Tracks Discord message ID for in-place card updates

2. **`organization_staff`** - Staff data (existing)

3. **`discord_category_templates`** - Category templates (new)
   - Stores saved Discord category configurations
   - Auto-created by Payload on first run

4. **`discord_server_manager`** - Server manager global (new)
   - UI-only global, minimal data stored
   - Auto-created by Payload on first run

5. **`discord_polls`** - Poll history (new, hidden)
   - Placeholder for Phase 2
   - Not used in Phase 1

### Migration:

If deploying to an existing database:

```sql
-- Add discordCardMessageId to teams table
ALTER TABLE teams ADD COLUMN IF NOT EXISTS "discordCardMessageId" VARCHAR(255);

-- Create discord_server_manager table
CREATE TABLE IF NOT EXISTS discord_server_manager (
  id SERIAL PRIMARY KEY,
  updated_at TIMESTAMP,
  created_at TIMESTAMP
);

-- Insert initial row
INSERT INTO discord_server_manager (id, updated_at, created_at) 
VALUES (1, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
```

---

## Discord Bot Setup

### 1. Create Discord Application

1. Go to https://discord.com/developers/applications
2. Click "New Application"
3. Name it "Elemental Bot" (or your preference)
4. Navigate to **Bot** section
5. Click "Reset Token" and copy the token
6. Save as `DISCORD_BOT_TOKEN` in environment variables

### 2. Enable Required Intents

In the **Bot** section, enable:
- ✅ **Presence Intent** (for online member count)
- ✅ **Server Members Intent** (for health checks)
- ✅ **Message Content Intent** (for bot commands)

### 3. Set Bot Permissions

Required permissions (integer: `8590065728`):
- View Channels
- Manage Channels
- Manage Roles
- Send Messages
- Manage Messages
- Embed Links
- Attach Files
- Read Message History
- Use Slash Commands

### 4. Invite Bot to Server

Use this URL template (replace `YOUR_CLIENT_ID`):

```
https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=8590065728&scope=bot%20applications.commands
```

**Finding Client ID:** Developer Portal → Your Application → General Information → Application ID

### 5. Deploy & Register Commands

After deploying the app with the bot token configured:

**Automatic Registration:**
- Slash commands auto-register on bot startup
- Takes 5-10 seconds to appear in Discord
- Refresh Discord if commands don't show immediately

**Manual Registration (if needed):**
```bash
# Via API route
curl -X POST http://your-domain.com/api/discord/register-commands
```

---

## Usage Guide

### For Admins:

#### **Managing Team Cards**
1. Edit teams in admin panel (`/admin/collections/teams`)
2. Cards auto-update on save
3. New teams trigger full refresh (all cards reposted in order)
4. Manual refresh: `POST /api/discord/team-cards` with `{"refreshAll": true}`

#### **Using Discord Server Manager**
1. Navigate to `/admin/globals/discord-server-manager`
2. Select tab (Structure, Templates, Statistics, Health Check)
3. Use drag-and-drop or buttons for operations
4. Changes apply immediately to Discord server

#### **Creating Templates**
1. Go to **Server Structure** tab
2. Find category you want to save
3. Click "Save as Template"
4. Name it and add description
5. Edit template in **Templates** tab to customize

#### **Applying Templates**
1. Go to **Templates** tab
2. Click "Apply" on desired template
3. Customize category name and channel names
4. Check "Make private" if needed
5. Remove unwanted channels (optional)
6. Click "Create Category"

### For Team Managers:

Team managers can use team lookup commands in Discord to check their team's status:

```
/team info bug
/team upcoming matches bug
/team match history bug
/team faceit bug
```

### For Discord Users:

Anyone in the server can use team lookup commands to view team information.

---

## Troubleshooting

### Team cards not appearing:

1. **Check channel ID:** Ensure `DISCORD_TEAM_CARDS_CHANNEL_ID` is correct
2. **Check bot permissions:** Bot needs `Send Messages` and `Embed Links` in that channel
3. **Check logs:** Look for errors in server console
4. **Manual trigger:**
   ```bash
   curl -X POST -H "Content-Type: application/json" \
     -d '{"refreshAll": true}' \
     http://localhost:3000/api/discord/team-cards
   ```

### Slash commands not showing:

1. **Wait 5-10 minutes:** Discord caches command registrations
2. **Check bot token:** Ensure `DISCORD_BOT_TOKEN` is valid
3. **Check guild ID:** Ensure `DISCORD_GUILD_ID` matches your server
4. **Reinvite bot:** Bot needs `applications.commands` scope
5. **Check logs:** Look for "Registered X commands" in console

### Images not loading in Discord:

1. **Check public URL:** `NEXT_PUBLIC_SERVER_URL` must be accessible from Discord's servers
2. **Use absolute URLs:** Localhost URLs won't work in production
3. **Check media file exists:** Ensure logos are uploaded and public
4. **Test URL:** Visit the image URL in a browser

### Server Manager errors:

1. **"Discord client not initialized":**
   - Bot token not configured
   - Bot failed to connect
   - Check server logs for connection errors

2. **"Channel not found":**
   - Channel was deleted outside the app
   - Click "Refresh" to update cache

3. **"Permission denied":**
   - Bot lacks required permissions
   - Check Discord bot role position (should be high enough to manage channels)

### Health Check issues:

1. **"Members without roles" not working:**
   - Requires `DISCORD_BOT_TOKEN` (not just client ID)
   - Requires Server Members Intent enabled
   - Fetches up to 1000 members (larger servers limited)

2. **Slow health check:**
   - Normal for large servers (1000+ members)
   - Member check batches API calls with 100ms delay

---

## File Structure

```
src/
├── discord/
│   ├── bot.ts                    # Discord client initialization
│   ├── commands/
│   │   ├── index.ts              # Command registration
│   │   ├── team-info.ts          # /team info command
│   │   ├── team-matches.ts       # /team upcoming matches
│   │   ├── team-history.ts       # /team match history
│   │   └── team-faceit.ts        # /team faceit command
│   ├── services/
│   │   └── teamCards.ts          # Team card posting/updating
│   └── utils/
│       └── embeds.ts             # Discord embed builders
│
├── app/api/discord/
│   ├── team-cards/route.ts       # Team card refresh API
│   ├── register-commands/route.ts # Command registration API
│   ├── server/
│   │   ├── structure/route.ts    # Get server structure
│   │   ├── stats/route.ts        # Get server statistics
│   │   ├── health/route.ts       # Server health check
│   │   ├── roles/route.ts        # Get server roles
│   │   ├── rename/route.ts       # Rename channels/categories
│   │   ├── delete/route.ts       # Delete channels/categories
│   │   ├── move/route.ts         # Move/reorder channels
│   │   ├── create-channel/route.ts # Create channels
│   │   └── clone-channel/route.ts  # Clone channels
│   └── templates/
│       ├── save/route.ts         # Save category template
│       ├── apply/route.ts        # Apply category template
│       ├── update/route.ts       # Update template
│       └── delete/route.ts       # Delete template
│
├── components/DiscordServerManager/
│   ├── DiscordServerManagerView.tsx  # Main UI component
│   ├── Modal.tsx                     # Custom modal component
│   ├── EditTemplateModal.tsx         # Template editor
│   ├── CreateChannelModal.tsx        # Channel creation modal
│   ├── ApplyTemplateModal.tsx        # Template application modal
│   ├── CategoryItem.tsx              # Category display component
│   └── ChannelItem.tsx               # Channel display component
│
├── collections/
│   ├── Teams/index.ts            # Teams collection (with Discord hooks)
│   ├── DiscordCategoryTemplates.ts   # Templates collection
│   └── DiscordPolls.ts           # Polls collection (Phase 2)
│
├── globals/
│   └── DiscordServerManager.ts   # Server Manager global
│
└── app/(payload)/styles/components/
    └── _discord-server-manager.scss  # Server Manager styles
```

---

## API Reference

### Team Cards API

**POST** `/api/discord/team-cards`

Trigger team card refresh.

**Request Body:**
```json
{
  "refreshAll": true,
  "teamId": "optional-specific-team-id"
}
```

**Response:**
```json
{
  "success": true,
  "message": "All team cards refreshed",
  "count": 25
}
```

### Server Structure API

**GET** `/api/discord/server/structure`

Get complete server structure.

**Response:**
```json
{
  "categories": [
    {
      "id": "123456789",
      "name": "GENERAL",
      "position": 0,
      "channels": [
        {
          "id": "987654321",
          "name": "announcements",
          "type": 0,
          "position": 0
        }
      ]
    }
  ],
  "uncategorized": [],
  "serverName": "Your Server",
  "memberCount": 1234
}
```

### Health Check API

**GET** `/api/discord/server/health`

Get server health report.

**Response:**
```json
{
  "score": 85,
  "status": "good",
  "issues": [
    {
      "type": "warning",
      "category": "Organization",
      "message": "12 channels are not in categories",
      "suggestion": "Consider organizing channels..."
    }
  ],
  "summary": {
    "errors": 0,
    "warnings": 1,
    "info": 0
  }
}
```

---

## Future Enhancements (Phase 2)

### Poll System
- Create schedule polls from admin panel
- Date range validation (max 25 options, max 10 days)
- Role mention selection
- Live vote tracking
- Team selection (limited to assigned teams)
- Access for Team/Staff Managers

### Schedule Builder
- Visual drag-and-drop interface
- Import poll results
- Generate formatted schedule text
- Copy to clipboard for manual posting

### Additional Improvements
- Bulk channel operations (delete, rename, move)
- Permission management UI for channels/roles
- Role creation and management
- Member management (assign roles, kick, ban)

---

## Support

**Issues?** Check troubleshooting section above or contact the development team.

**Feature Requests?** Log them for Phase 2 planning.

**Documentation Updates?** Keep this file updated as features evolve.

---

**Last Updated:** January 5, 2026  
**Version:** 1.0.0 (Phase 1)  
**Status:** ✅ Production Ready
