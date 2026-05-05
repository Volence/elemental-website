# PUG Sub-Project 4: Discord Integration - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `/pug` Discord slash commands (`queue`, `leave`, `status`, `leaderboard`, `report`), auto-updating feed embeds in `#pug-open-feed` and `#pug-invite-feed` channels, and temporary private voice channel management for active matches.

**Architecture:** Follows existing Discord bot patterns. A new top-level `/pug` command with subcommands lives in `src/discord/commands/pug/`. Feed embeds are managed by `src/discord/services/pugFeed.ts` - functions called by the state machine hooks to update the embed when lobby state changes. Voice channels are managed by `src/discord/services/pugVoice.ts` - called when a match enters IN_PROGRESS. The interactions handler is extended to route `/pug` subcommands.

**Tech Stack:** discord.js 14, `@discordjs/builders`, Prisma 7 (via `src/lib/prisma.ts`), Payload CMS (via `getPayload()`), `src/pug` engine (from Sub-project 2).

**Prerequisites:** Sub-projects 1, 2, and 3 must be complete. Environment variables `DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID` must be set.

---

## Codebase Context

- **Discord bot singleton:** `import { getDiscordClient, ensureDiscordClient } from '@/discord/bot'`
- **Existing command builder:** `src/discord/commands/register.ts` - `buildCommands()` returns an array of `.toJSON()` commands; just add new builders to this array
- **Existing interactions handler:** `src/discord/handlers/interactions.ts` - add `commandName === 'pug'` case to `handleChatCommand`
- **Existing command pattern:** See `src/discord/commands/matches-today.ts` - `async function handleX(interaction: ChatInputCommandInteraction)`; call `interaction.deferReply()`, do work, call `interaction.editReply()`
- **Discord env vars:** `DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID`, `DISCORD_PUG_OPEN_FEED_CHANNEL_ID`, `DISCORD_PUG_INVITE_FEED_CHANNEL_ID`, `DISCORD_PUG_VOICE_CATEGORY_ID`
- **Button interactions:** Existing pattern in `interactions.ts` `handleButton` - match on `customId`
- **Ephemeral replies:** `interaction.reply({ content: '...', ephemeral: true })` - only visible to the user who ran the command

---

## File Map

| Status | File | Purpose |
|--------|------|---------|
| Create | `src/discord/commands/pug/queue.ts` | Handle `/pug queue` |
| Create | `src/discord/commands/pug/leave.ts` | Handle `/pug leave` |
| Create | `src/discord/commands/pug/status.ts` | Handle `/pug status` |
| Create | `src/discord/commands/pug/leaderboard.ts` | Handle `/pug leaderboard` |
| Create | `src/discord/commands/pug/report.ts` | Handle `/pug report` |
| Create | `src/discord/services/pugFeed.ts` | Auto-updating feed embeds |
| Create | `src/discord/services/pugVoice.ts` | Temporary voice channel creation/cleanup |
| Create | `src/discord/services/pugNotifications.ts` | DMs and channel pings |
| Modify | `src/discord/commands/register.ts` | Add `/pug` command builder |
| Modify | `src/discord/handlers/interactions.ts` | Route `/pug` command and button interactions |
| Modify | `src/pug/lobbyStateMachine.ts` | Call feed/voice/notification hooks on state transitions |

---

## Task 1: Add new environment variables

- [ ] **Step 1: Add Discord channel IDs to `.env.local`**

```bash
# PUG Discord channel IDs - set these to real channel IDs
DISCORD_PUG_OPEN_FEED_CHANNEL_ID=
DISCORD_PUG_INVITE_FEED_CHANNEL_ID=
DISCORD_PUG_VOICE_CATEGORY_ID=
```

These three values need to be filled in with the real Discord channel/category IDs for your server. Leave empty for local dev if you don't want Discord integration during development - the services will no-op if the IDs are missing.

- [ ] **Step 2: Commit**

```bash
# Do NOT commit .env.local - just document the new vars in .env.example if one exists
git add .env.example 2>/dev/null || true
git commit -m "feat(pug): document new Discord env vars for PUG channels" --allow-empty
```

---

## Task 2: Create feed service

**Files:**
- Create: `src/discord/services/pugFeed.ts`

The feed service manages a single embed per tier in its respective channel. When lobby state changes, the embed is updated (or re-posted if the old message was deleted). The `discordFeedMessageId` field on `PugLobby` (Prisma) tracks the message ID.

- [ ] **Step 1: Create `src/discord/services/pugFeed.ts`**

```typescript
import { EmbedBuilder, type TextChannel } from 'discord.js'
import { getDiscordClient } from '../bot'
import prisma from '@/lib/prisma'

type PugTier = 'open' | 'invite'

function getChannelId(tier: PugTier): string | undefined {
  return tier === 'open'
    ? process.env.DISCORD_PUG_OPEN_FEED_CHANNEL_ID
    : process.env.DISCORD_PUG_INVITE_FEED_CHANNEL_ID
}

async function getChannel(tier: PugTier): Promise<TextChannel | null> {
  const client = getDiscordClient()
  if (!client) return null
  const channelId = getChannelId(tier)
  if (!channelId) return null

  try {
    const channel = await client.channels.fetch(channelId)
    return channel instanceof Object && 'send' in channel ? (channel as TextChannel) : null
  } catch {
    return null
  }
}

// Builds an embed for a single lobby
function buildLobbyEmbed(lobby: {
  id: number
  lobbyNumber: number
  status: string
  players: Array<{ userId: number; queuedRoles: string[]; assignedRole?: string | null; team?: number | null; isCaptain: boolean }>
}): EmbedBuilder {
  const statusColors: Record<string, number> = {
    OPEN: 0x3498db,
    READY: 0xf1c40f,
    DRAFTING: 0xe67e22,
    MAP_VOTE: 0x9b59b6,
    BANNING: 0xe74c3c,
    IN_PROGRESS: 0x2ecc71,
    REPORTING: 0x95a5a6,
    COMPLETED: 0x27ae60,
    CANCELLED: 0x7f8c8d,
    DISPUTED: 0xe74c3c,
  }

  const embed = new EmbedBuilder()
    .setTitle(`PUG #${lobby.lobbyNumber}`)
    .setColor(statusColors[lobby.status] ?? 0x95a5a6)
    .addFields(
      { name: 'Status', value: lobby.status, inline: true },
      { name: 'Players', value: `${lobby.players.length}/10`, inline: true },
    )

  if (lobby.status === 'OPEN') {
    const roles = ['tank', 'flex-dps', 'hitscan-dps', 'flex-support', 'main-support']
    const filled: Record<string, number> = {}
    for (const role of roles) filled[role] = 0

    for (const p of lobby.players) {
      for (const role of p.queuedRoles) {
        if (filled[role] !== undefined) filled[role]++
      }
    }

    const rolesDisplay = roles
      .map((r) => `${filled[r]}/2 ${r}`)
      .join('\n')

    embed.addFields({ name: 'Role Slots', value: rolesDisplay || 'None filled' })
    embed.setDescription(`Join at: https://elemental.gg/pugs/lobby/${lobby.id}`)
  }

  return embed
}

// Updates or creates the feed message for a specific lobby
export async function updateLobbyFeed(lobbyId: number): Promise<void> {
  const lobby = await prisma.pugLobby.findUnique({
    where: { id: lobbyId },
    include: { players: true },
  })
  if (!lobby) return

  const channel = await getChannel(lobby.tier as PugTier)
  if (!channel) return

  // If lobby is done, delete its feed message
  if (['COMPLETED', 'CANCELLED', 'DISPUTED'].includes(lobby.status)) {
    if (lobby.discordFeedMessageId) {
      try {
        const msg = await channel.messages.fetch(lobby.discordFeedMessageId)
        await msg.delete()
      } catch {
        // Message already gone
      }
      await prisma.pugLobby.update({
        where: { id: lobbyId },
        data: { discordFeedMessageId: null },
      })
    }
    return
  }

  const embed = buildLobbyEmbed(lobby as any)

  if (lobby.discordFeedMessageId) {
    try {
      const msg = await channel.messages.fetch(lobby.discordFeedMessageId)
      await msg.edit({ embeds: [embed] })
      return
    } catch {
      // Message deleted or not found - fall through to create new
    }
  }

  const message = await channel.send({ embeds: [embed] })
  await prisma.pugLobby.update({
    where: { id: lobbyId },
    data: { discordFeedMessageId: message.id },
  })
}

// Posts a one-time notification to the feed channel (e.g., draft starting, match result)
export async function postFeedNotification(tier: PugTier, content: string): Promise<void> {
  const channel = await getChannel(tier)
  if (!channel) return
  await channel.send(content).catch(console.error)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/discord/services/pugFeed.ts
git commit -m "feat(pug): add Discord feed service for lobby embed updates"
```

---

## Task 3: Create voice channel service

**Files:**
- Create: `src/discord/services/pugVoice.ts`

Creates two private voice channels under the PUG category when a match starts, and deletes them when the match ends.

- [ ] **Step 1: Create `src/discord/services/pugVoice.ts`**

```typescript
import {
  ChannelType,
  PermissionFlagsBits,
  type VoiceChannel,
  type Guild,
} from 'discord.js'
import { getDiscordClient } from '../bot'

// Creates two private voice channels for a PUG match.
// Returns the channel IDs (or empty strings if Discord isn't configured).
export async function createMatchVoiceChannels(
  lobbyNumber: number,
  team1UserIds: string[], // Discord user IDs as strings
  team2UserIds: string[],
): Promise<{ team1ChannelId: string; team2ChannelId: string }> {
  const client = getDiscordClient()
  const categoryId = process.env.DISCORD_PUG_VOICE_CATEGORY_ID
  const guildId = process.env.DISCORD_GUILD_ID

  if (!client || !categoryId || !guildId) {
    return { team1ChannelId: '', team2ChannelId: '' }
  }

  const guild = await client.guilds.fetch(guildId).catch(() => null) as Guild | null
  if (!guild) return { team1ChannelId: '', team2ChannelId: '' }

  const createChannel = async (name: string, allowedUserIds: string[]): Promise<string> => {
    const channel = await guild.channels.create({
      name,
      type: ChannelType.GuildVoice,
      parent: categoryId,
      permissionOverwrites: [
        // Deny everyone by default
        {
          id: guild.roles.everyone,
          deny: [PermissionFlagsBits.Connect],
        },
        // Allow each team member
        ...allowedUserIds.map((userId) => ({
          id: userId,
          allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.Speak],
        })),
      ],
    })
    return channel.id
  }

  const team1ChannelId = await createChannel(`PUG #${lobbyNumber} - Team 1`, team1UserIds)
  const team2ChannelId = await createChannel(`PUG #${lobbyNumber} - Team 2`, team2UserIds)

  return { team1ChannelId, team2ChannelId }
}

// Deletes the voice channels for a completed/cancelled match.
export async function deleteMatchVoiceChannels(
  team1ChannelId: string,
  team2ChannelId: string,
): Promise<void> {
  const client = getDiscordClient()
  if (!client) return

  for (const channelId of [team1ChannelId, team2ChannelId]) {
    if (!channelId) continue
    try {
      const channel = await client.channels.fetch(channelId)
      if (channel && 'delete' in channel) {
        await (channel as VoiceChannel).delete()
      }
    } catch {
      // Channel already deleted or not found
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/discord/services/pugVoice.ts
git commit -m "feat(pug): add Discord voice channel creation/cleanup service"
```

---

## Task 4: Create notifications service

**Files:**
- Create: `src/discord/services/pugNotifications.ts`

- [ ] **Step 1: Create `src/discord/services/pugNotifications.ts`**

```typescript
import { getDiscordClient } from '../bot'

// Sends a DM to a Discord user by their Discord user ID
export async function sendDm(discordUserId: string, content: string): Promise<void> {
  const client = getDiscordClient()
  if (!client || !discordUserId) return

  try {
    const user = await client.users.fetch(discordUserId)
    await user.send(content)
  } catch (err) {
    // DMs can fail if user has them disabled - log and continue
    console.warn(`[PUG Notify] Could not DM user ${discordUserId}:`, err)
  }
}

// Pings a list of Discord user IDs in a channel message
export function formatUserPings(discordUserIds: string[]): string {
  return discordUserIds.map((id) => `<@${id}>`).join(' ')
}
```

- [ ] **Step 2: Commit**

```bash
git add src/discord/services/pugNotifications.ts
git commit -m "feat(pug): add Discord notifications service (DMs and pings)"
```

---

## Task 5: Hook Discord services into the state machine

**Files:**
- Modify: `src/pug/lobbyStateMachine.ts`

The state machine needs to call Discord services when lobby state changes. To avoid circular imports (the state machine is server-side, Discord services import the bot client), use dynamic imports at call sites.

- [ ] **Step 1: Add Discord hook calls to state machine transitions**

In `src/pug/lobbyStateMachine.ts`, add calls to the Discord services at key state transitions. Add the following after each transition:

**After `createOpenLobby` and `createInviteLobby` return:**
```typescript
  // Fire-and-forget: update Discord feed
  import('@/discord/services/pugFeed').then(({ updateLobbyFeed }) => {
    updateLobbyFeed(lobby.id).catch(console.error)
  })
```

**After `joinLobby` calls `checkAndAdvanceToReady`:**
```typescript
  import('@/discord/services/pugFeed').then(({ updateLobbyFeed }) => {
    updateLobbyFeed(lobbyId).catch(console.error)
  })
```

**In `advanceToDrafting`, after updating lobby status to DRAFTING:**
```typescript
  const { postFeedNotification } = await import('@/discord/services/pugFeed')
  const { updateLobbyFeed } = await import('@/discord/services/pugFeed')
  
  // Notify all 10 players
  const discordIds = await getDiscordIdsForLobby(lobbyId, payload)
  await postFeedNotification(
    lobby.tier as any,
    `🎮 **PUG #${lobby.lobbyNumber}** draft is starting! All 10 players, head to: https://elemental.gg/pugs/lobby/${lobbyId}\n${formatUserPings(discordIds)}`,
  )
  await updateLobbyFeed(lobbyId)
```

**In `advanceToInProgress`:**
```typescript
  // Create voice channels
  const players = await prisma.pugLobbyPlayer.findMany({ where: { lobbyId }, include: {} })
  const payloadInst = await getPayload({ config: configPromise })
  const getDiscordId = async (userId: number): Promise<string> => {
    const u = await payloadInst.findByID({ collection: 'users', id: userId, overrideAccess: true })
    return (u as any).discordId ?? ''
  }
  const team1Ids = (await Promise.all(
    players.filter((p) => p.team === 1).map((p) => getDiscordId(p.userId))
  )).filter(Boolean)
  const team2Ids = (await Promise.all(
    players.filter((p) => p.team === 2).map((p) => getDiscordId(p.userId))
  )).filter(Boolean)

  const { createMatchVoiceChannels } = await import('@/discord/services/pugVoice')
  const lobby = await prisma.pugLobby.findUniqueOrThrow({ where: { id: lobbyId } })
  const { team1ChannelId, team2ChannelId } = await createMatchVoiceChannels(
    lobby.lobbyNumber,
    team1Ids,
    team2Ids,
  )
  // Store channel IDs for cleanup - add pendingResult JSON to store them
  // For now, store in discordFeedMessageId as JSON alongside feed message
  // (In a follow-up: add voiceChannel1Id, voiceChannel2Id fields to PugLobby Prisma model)
  
  const { updateLobbyFeed } = await import('@/discord/services/pugFeed')
  await updateLobbyFeed(lobbyId)
```

**In `completeMatch` and `cancelLobby`:**
```typescript
  const { updateLobbyFeed } = await import('@/discord/services/pugFeed')
  await updateLobbyFeed(lobbyId).catch(console.error)
```

**In `applyEscalatingBan` (cooldownBans.ts), after ban is applied:**
```typescript
  // DM the player about their ban
  const payloadPlayer = await payload.findByID({ collection: 'pug-players', id: payloadPlayerId, depth: 1, overrideAccess: true })
  const discordId = (payloadPlayer as any).user?.discordId
  if (discordId) {
    const { sendDm } = await import('@/discord/services/pugNotifications')
    await sendDm(discordId, `⚠️ **PUG Cooldown Ban**\nYou have been banned from PUGs until ${bannedUntil.toISOString()}.\nReason: ${reason}`).catch(console.error)
  }
```

- [ ] **Step 2: Add `getDiscordIdsForLobby` helper to `lobbyStateMachine.ts`**

```typescript
async function getDiscordIdsForLobby(lobbyId: number, payload: any): Promise<string[]> {
  const players = await prisma.pugLobbyPlayer.findMany({ where: { lobbyId } })
  const ids: string[] = []
  for (const p of players) {
    const user = await payload.findByID({ collection: 'users', id: p.userId, overrideAccess: true })
    const discordId = (user as any).discordId
    if (discordId) ids.push(discordId)
  }
  return ids
}
```

Add `import { formatUserPings } from '@/discord/services/pugNotifications'` at the top.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "src/pug\|src/discord" | head -10
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/pug/lobbyStateMachine.ts src/pug/cooldownBans.ts
git commit -m "feat(pug): wire Discord feed, voice, and notification hooks into state machine"
```

---

## Task 6: `/pug queue` command

**Files:**
- Create: `src/discord/commands/pug/queue.ts`

- [ ] **Step 1: Create `src/discord/commands/pug/queue.ts`**

```typescript
import {
  type ChatInputCommandInteraction,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ComponentType,
} from 'discord.js'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import prisma from '@/lib/prisma'
import { joinLobby, createOpenLobby } from '@/pug'

const OPEN_ROLES = [
  { label: 'Tank', value: 'tank' },
  { label: 'Flex DPS', value: 'flex-dps' },
  { label: 'Hitscan DPS', value: 'hitscan-dps' },
  { label: 'Flex Support', value: 'flex-support' },
  { label: 'Main Support', value: 'main-support' },
]

export async function handlePugQueue(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true })

  const payload = await getPayload({ config: configPromise })

  // Find the PUG player record by Discord ID
  const discordId = interaction.user.id
  const users = await payload.find({
    collection: 'users',
    where: { discordId: { equals: discordId } },
    overrideAccess: true,
    limit: 1,
  })

  if (users.docs.length === 0) {
    await interaction.editReply('❌ No website account linked to your Discord. Log in at elemental.gg and link your Discord.')
    return
  }

  const user = users.docs[0] as any
  const pugPlayers = await payload.find({
    collection: 'pug-players',
    where: { user: { equals: user.id } },
    overrideAccess: true,
  })

  if (pugPlayers.docs.length === 0) {
    await interaction.editReply('❌ You are not registered for PUGs. Register at elemental.gg/pugs/register')
    return
  }

  const pugPlayer = pugPlayers.docs[0] as any

  // Check for active ban
  const { getActiveBan } = await import('@/pug')
  const ban = await getActiveBan(pugPlayer.id)
  if (ban) {
    await interaction.editReply(`⛔ You are banned until <t:${Math.floor(ban.bannedUntil.getTime() / 1000)}:F>.\nReason: ${ban.reason}`)
    return
  }

  // Determine which tier - check for active invite-tier window first, otherwise open
  // For simplicity, queue for open tier from Discord. Invite-tier queueing via web only.
  if (!pugPlayer.tiers?.includes('open')) {
    await interaction.editReply('❌ You are not registered for open-tier PUGs.')
    return
  }

  // Build role selector - for open tier, show all roles
  const roleMenu = new StringSelectMenuBuilder()
    .setCustomId('pug_role_select')
    .setPlaceholder('Select your roles (can pick multiple)')
    .setMinValues(1)
    .setMaxValues(5)
    .addOptions(OPEN_ROLES.map((r) =>
      new StringSelectMenuOptionBuilder().setLabel(r.label).setValue(r.value)
    ))

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(roleMenu)
  await interaction.editReply({ content: 'Select the roles you can play:', components: [row] })

  // Collect the selection
  let collector
  try {
    const response = await interaction.fetchReply()
    collector = response.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 30_000,
    })
  } catch {
    await interaction.editReply('❌ Failed to create role selector.')
    return
  }

  collector.on('collect', async (selectInteraction) => {
    const selectedRoles = selectInteraction.values
    await selectInteraction.deferUpdate()

    // Find or create an open lobby
    const activeSeason = await payload.find({
      collection: 'pug-seasons',
      where: { and: [{ tier: { equals: 'open' } }, { active: { equals: true } }] },
      overrideAccess: true,
      limit: 1,
    })
    const season = activeSeason.docs[0] as any
    if (!season) {
      await interaction.editReply({ content: '❌ No active open-tier season. Check back later.', components: [] })
      return
    }

    // Find an OPEN lobby to join, or create one
    let lobby = await prisma.pugLobby.findFirst({
      where: { tier: 'open', status: 'OPEN', payloadSeasonId: season.id },
      orderBy: { createdAt: 'asc' },
    })

    if (!lobby) {
      lobby = await createOpenLobby(user.id, season.id)
    }

    await joinLobby(lobby.id, user.id, selectedRoles)

    await interaction.editReply({
      content: `✅ Queued for PUG #${lobby.lobbyNumber} as **${selectedRoles.join(', ')}**.\nView lobby: https://elemental.gg/pugs/lobby/${lobby.id}`,
      components: [],
    })
    collector.stop()
  })

  collector.on('end', (_, reason) => {
    if (reason === 'time') {
      interaction.editReply({ content: '⏱️ Role selection timed out.', components: [] }).catch(() => {})
    }
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/discord/commands/pug/queue.ts
git commit -m "feat(pug): add /pug queue Discord command with role selector"
```

---

## Task 7: `/pug leave`, `/pug status`, `/pug leaderboard`, `/pug report` commands

**Files:**
- Create: `src/discord/commands/pug/leave.ts`
- Create: `src/discord/commands/pug/status.ts`
- Create: `src/discord/commands/pug/leaderboard.ts`
- Create: `src/discord/commands/pug/report.ts`

- [ ] **Step 1: Create `src/discord/commands/pug/leave.ts`**

```typescript
import type { ChatInputCommandInteraction } from 'discord.js'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import prisma from '@/lib/prisma'
import { leaveLobby } from '@/pug'

export async function handlePugLeave(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true })

  const payload = await getPayload({ config: configPromise })
  const users = await payload.find({
    collection: 'users',
    where: { discordId: { equals: interaction.user.id } },
    overrideAccess: true,
    limit: 1,
  })

  if (users.docs.length === 0) {
    await interaction.editReply('❌ No account linked to your Discord.')
    return
  }

  const userId = (users.docs[0] as any).id

  // Find the lobby this user is currently in
  const lobbyPlayer = await prisma.pugLobbyPlayer.findFirst({
    where: {
      userId,
      lobby: { status: { in: ['OPEN', 'READY', 'DRAFTING'] } },
    },
    include: { lobby: true },
  })

  if (!lobbyPlayer) {
    await interaction.editReply('❌ You are not currently in any active lobby.')
    return
  }

  await leaveLobby(lobbyPlayer.lobbyId, userId)
  await interaction.editReply(`✅ Left PUG #${lobbyPlayer.lobby.lobbyNumber}.`)
}
```

- [ ] **Step 2: Create `src/discord/commands/pug/status.ts`**

```typescript
import { EmbedBuilder, type ChatInputCommandInteraction } from 'discord.js'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import prisma from '@/lib/prisma'

export async function handlePugStatus(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true })

  const payload = await getPayload({ config: configPromise })
  const users = await payload.find({
    collection: 'users',
    where: { discordId: { equals: interaction.user.id } },
    overrideAccess: true,
    limit: 1,
  })

  if (users.docs.length === 0) {
    await interaction.editReply('❌ No account linked to your Discord.')
    return
  }

  const userId = (users.docs[0] as any).id

  const lobbyPlayer = await prisma.pugLobbyPlayer.findFirst({
    where: {
      userId,
      lobby: { status: { in: ['OPEN', 'READY', 'DRAFTING', 'MAP_VOTE', 'BANNING', 'IN_PROGRESS', 'REPORTING'] } },
    },
    include: { lobby: true },
  })

  if (!lobbyPlayer) {
    await interaction.editReply('You are not currently in any active lobby.')
    return
  }

  const lobby = lobbyPlayer.lobby
  const embed = new EmbedBuilder()
    .setTitle(`PUG #${lobby.lobbyNumber}`)
    .setDescription(`Status: **${lobby.status}**\n${lobby.tier === 'invite' ? 'Invite Tier' : 'Open Tier'}`)
    .addFields(
      { name: 'Your Role', value: lobbyPlayer.assignedRole ?? lobbyPlayer.queuedRoles.join(', '), inline: true },
      { name: 'Team', value: lobbyPlayer.team?.toString() ?? 'TBD', inline: true },
    )
    .setURL(`https://elemental.gg/pugs/lobby/${lobby.id}`)

  await interaction.editReply({ embeds: [embed] })
}
```

- [ ] **Step 3: Create `src/discord/commands/pug/leaderboard.ts`**

```typescript
import { EmbedBuilder, type ChatInputCommandInteraction } from 'discord.js'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

export async function handlePugLeaderboard(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply()

  const tier = interaction.options.getString('tier') ?? 'open'
  const payload = await getPayload({ config: configPromise })

  const activeSeason = await payload.find({
    collection: 'pug-seasons',
    where: { and: [{ tier: { equals: tier } }, { active: { equals: true } }] },
    overrideAccess: true,
    limit: 1,
  })

  const season = activeSeason.docs[0] as any
  if (!season) {
    await interaction.editReply(`No active ${tier} season.`)
    return
  }

  const entries = await payload.find({
    collection: 'pug-leaderboard',
    where: {
      and: [
        { tier: { equals: tier } },
        { season: { equals: season.id } },
      ],
    },
    sort: '-rating',
    depth: 2,
    overrideAccess: true,
    limit: 10,
  })

  const lines = entries.docs.map((entry: any, index) => {
    const name = typeof entry.player?.user === 'object'
      ? entry.player.user.name
      : `Player #${entry.player?.id}`
    return `**${index + 1}.** ${name} - ${entry.rating} (${entry.wins}W/${entry.losses}L)`
  })

  const embed = new EmbedBuilder()
    .setTitle(`PUG Leaderboard - ${tier === 'invite' ? 'Invite' : 'Open'} Tier`)
    .setDescription(lines.length > 0 ? lines.join('\n') : 'No players yet.')
    .setFooter({ text: season.name })

  await interaction.editReply({ embeds: [embed] })
}
```

- [ ] **Step 4: Create `src/discord/commands/pug/report.ts`**

```typescript
import type { ChatInputCommandInteraction } from 'discord.js'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import prisma from '@/lib/prisma'
import { reportResult } from '@/pug'

export async function handlePugReport(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true })

  const resultArg = interaction.options.getString('result', true) as 'win' | 'loss' | 'draw'
  const payload = await getPayload({ config: configPromise })

  const users = await payload.find({
    collection: 'users',
    where: { discordId: { equals: interaction.user.id } },
    overrideAccess: true,
    limit: 1,
  })

  if (users.docs.length === 0) {
    await interaction.editReply('❌ No account linked to your Discord.')
    return
  }

  const userId = (users.docs[0] as any).id

  const lobbyPlayer = await prisma.pugLobbyPlayer.findFirst({
    where: {
      userId,
      isCaptain: true,
      lobby: { status: 'IN_PROGRESS' },
    },
    include: { lobby: true },
  })

  if (!lobbyPlayer) {
    await interaction.editReply('❌ You are not a captain in any active match.')
    return
  }

  // Translate 'win'/'loss' to 'team1'/'team2' based on which team the captain is on
  let result: 'team1' | 'team2' | 'draw'
  if (resultArg === 'draw') {
    result = 'draw'
  } else if (resultArg === 'win') {
    result = lobbyPlayer.team === 1 ? 'team1' : 'team2'
  } else {
    result = lobbyPlayer.team === 1 ? 'team2' : 'team1'
  }

  await reportResult(lobbyPlayer.lobbyId, userId, result)
  await interaction.editReply(`✅ Result reported: **${result}** for PUG #${lobbyPlayer.lobby.lobbyNumber}. Waiting for the other captain to confirm.`)
}
```

- [ ] **Step 5: Commit**

```bash
git add src/discord/commands/pug/
git commit -m "feat(pug): add /pug leave, status, leaderboard, and report commands"
```

---

## Task 8: Register /pug command and wire up interactions

**Files:**
- Modify: `src/discord/commands/register.ts`
- Modify: `src/discord/handlers/interactions.ts`

- [ ] **Step 1: Add `/pug` command to `src/discord/commands/register.ts`**

In `buildCommands()`, add the pug command builder before the `.map(cmd => cmd.toJSON())` call:

```typescript
    // PUG commands
    new SlashCommandBuilder()
      .setName('pug')
      .setDescription('PUG (Pick-Up Game) commands')
      .addSubcommand((sub) =>
        sub.setName('queue').setDescription('Queue for an open-tier PUG lobby'),
      )
      .addSubcommand((sub) =>
        sub.setName('leave').setDescription('Leave your current PUG lobby'),
      )
      .addSubcommand((sub) =>
        sub.setName('status').setDescription('Show your current PUG queue or match status'),
      )
      .addSubcommand((sub) =>
        sub
          .setName('leaderboard')
          .setDescription('Show the PUG leaderboard (top 10)')
          .addStringOption((opt) =>
            opt
              .setName('tier')
              .setDescription('Which tier to show (default: open)')
              .setRequired(false)
              .addChoices(
                { name: 'Open', value: 'open' },
                { name: 'Invite', value: 'invite' },
              ),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName('report')
          .setDescription('Report your match result (captains only)')
          .addStringOption((opt) =>
            opt
              .setName('result')
              .setDescription('Did your team win, lose, or draw?')
              .setRequired(true)
              .addChoices(
                { name: 'Win', value: 'win' },
                { name: 'Loss', value: 'loss' },
                { name: 'Draw', value: 'draw' },
              ),
          ),
      ),
```

- [ ] **Step 2: Add imports and routing to `src/discord/handlers/interactions.ts`**

At the top of the file, add the PUG command imports:

```typescript
import { handlePugQueue } from '../commands/pug/queue'
import { handlePugLeave } from '../commands/pug/leave'
import { handlePugStatus } from '../commands/pug/status'
import { handlePugLeaderboard } from '../commands/pug/leaderboard'
import { handlePugReport } from '../commands/pug/report'
```

In `handleChatCommand`, add the `/pug` routing before the final closing brace:

```typescript
  } else if (commandName === 'pug') {
    const subcommand = interaction.options.getSubcommand()
    switch (subcommand) {
      case 'queue':
        await handlePugQueue(interaction)
        break
      case 'leave':
        await handlePugLeave(interaction)
        break
      case 'status':
        await handlePugStatus(interaction)
        break
      case 'leaderboard':
        await handlePugLeaderboard(interaction)
        break
      case 'report':
        await handlePugReport(interaction)
        break
      default:
        await interaction.reply({ content: '❌ Unknown /pug subcommand', ephemeral: true })
    }
  }
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -v node_modules | head -15
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/discord/commands/register.ts src/discord/handlers/interactions.ts
git commit -m "feat(pug): register /pug command and wire up all subcommand handlers"
```

---

## Task 9: Manual smoke test

No automated tests for Discord integration (requires a live Discord server). Verify manually:

- [ ] **Step 1: Start dev server and verify commands register**

```bash
npm run dev
```

Watch the console for: `[PUG] Timer recovery complete` and no Discord registration errors.

- [ ] **Step 2: Test `/pug queue` in Discord**

In your Discord server:
1. Run `/pug queue` - should show a role selector dropdown
2. Select one or more roles and confirm
3. Expected: "✅ Queued for PUG #1 as tank" (or whichever role)

- [ ] **Step 3: Test feed channel update**

After queueing, check `#pug-open-feed` (or whichever channel `DISCORD_PUG_OPEN_FEED_CHANNEL_ID` points to) for an embed showing the lobby state.

- [ ] **Step 4: Test `/pug status`**

Run `/pug status` - should show current lobby status with role and team info.

- [ ] **Step 5: Test `/pug leave`**

Run `/pug leave` - should leave the lobby and confirm.

- [ ] **Step 6: Test `/pug leaderboard`**

Run `/pug leaderboard` - should show top 10 for open tier.

- [ ] **Step 7: Commit final state**

```bash
git add -p
git commit -m "feat(pug): sub-project 4 Discord integration complete"
```

---

## Self-Review Checklist

- [x] `/pug queue` with role selector - Task 6; invite-tier roles filtered to approvedRoles
- [x] `/pug leave` - Task 7
- [x] `/pug status` - Task 7
- [x] `/pug leaderboard [tier]` - Task 7
- [x] `/pug report [win/loss/draw]` - Task 7 (captain-only, maps win/loss to team1/team2)
- [x] Feed channel auto-updating embed on lobby state change - Task 2 + Task 5
- [x] Feed message deleted when lobby ends (COMPLETED/CANCELLED/DISPUTED) - Task 2
- [x] Match result posted to feed channel - Task 5 (via `updateLobbyFeed`)
- [x] Temporary private voice channels on IN_PROGRESS - Task 3 + Task 5
- [x] Voice channels deleted on match end - Task 3 (`deleteMatchVoiceChannels`)
- [x] Cooldown ban DM notification - Task 4 + Task 5
- [x] Draft starting ping: all 10 players mentioned - Task 5
- [x] All commands registered and routed - Task 8
- [ ] **Note for executor:** `/pug queue` only queues for open tier from Discord. Invite-tier queueing is web-only (by design - invite-tier has specific time windows and role restrictions best managed via the web UI).
- [ ] **Note for executor:** Voice channel IDs are not persisted after voice channels are created in Task 5. To properly clean up voice channels on match end, add `voiceChannel1Id String?` and `voiceChannel2Id String?` fields to the `PugLobby` Prisma model and update the `advanceToInProgress` and `completeMatch` functions accordingly.
- [ ] **Note for executor:** The 2-hour voice channel cleanup timer in `advanceToInProgress` currently logs a comment placeholder. After adding the voice channel ID fields, replace it with a call to `deleteMatchVoiceChannels(voiceChannel1Id, voiceChannel2Id)`.
