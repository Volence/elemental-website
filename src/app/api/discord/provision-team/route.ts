import { NextRequest, NextResponse } from 'next/server'
import { ensureDiscordClient } from '@/discord/bot'
import { ChannelType, PermissionFlagsBits } from 'discord.js'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

/**
 * Lighten a hex color by a given amount (0-1)
 */
function lightenColor(hex: string, amount: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)

  const lr = Math.min(255, Math.round(r + (255 - r) * amount))
  const lg = Math.min(255, Math.round(g + (255 - g) * amount))
  const lb = Math.min(255, Math.round(b + (255 - b) * amount))

  return `#${lr.toString(16).padStart(2, '0')}${lg.toString(16).padStart(2, '0')}${lb.toString(16).padStart(2, '0')}`
}

/**
 * Convert hex color to Discord integer color
 */
function hexToInt(hex: string): number {
  return parseInt(hex.replace('#', ''), 16)
}

/**
 * Channel definitions for team provisioning.
 * 
 * PERMISSION MODEL:
 * - Category-level permissions serve as DEFAULT for all channels
 * - Only per-channel EXCEPTIONS are defined here (overrides that differ from category defaults)
 * 
 * Category defaults:
 *   @everyone:     deny ViewChannel (private category)
 *   Team role:     allow View, Send, Connect, threads
 *   Access role:   allow View, Send, Connect, threads
 *   Shared roles:  allow Send, Connect, threads (NOT View — view comes from Team/Access)
 */
const CHANNEL_DEFS: Array<{
  nameTemplate: (n: string) => string
  type: ChannelType
  exceptions?: {
    team?: { deny: bigint[] }
    access?: { deny: bigint[] }
  }
  forumPosts?: (n: string) => string[]
}> = [
  {
    nameTemplate: (n: string) => `${n.toLowerCase()}-chat`,
    type: ChannelType.GuildText,
    // No exceptions — inherits all category defaults
  },
  {
    nameTemplate: (n: string) => `${n.toLowerCase()}-announcements`,
    type: ChannelType.GuildText,
    // Exception: Team and Access can't send messages (read-only for regular members)
    // Managers/Coaches/Captains CAN send (inherited from category-level allow)
    exceptions: {
      team: { deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.SendMessagesInThreads, PermissionFlagsBits.CreatePublicThreads] },
      access: { deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.SendMessagesInThreads, PermissionFlagsBits.CreatePublicThreads] },
    },
  },
  {
    nameTemplate: (n: string) => `${n.toLowerCase()}-team-info`,
    type: ChannelType.GuildForum,
    // No exceptions — inherits all category defaults
    forumPosts: (n: string) => [
      `${n} Player Info`,
      `${n} Calendar`,
      `${n} Availability`,
      `${n} Schedule`,
    ],
  },
  {
    nameTemplate: (n: string) => `${n.toLowerCase()}-coaching`,
    type: ChannelType.GuildForum,
    // Exception: Access role can't see coaching
    exceptions: {
      access: { deny: [PermissionFlagsBits.ViewChannel] },
    },
    forumPosts: (n: string) => [
      `${n} Coaching`,
      `${n} Scrim Codes`,
    ],
  },
  {
    nameTemplate: (n: string) => `${n.toLowerCase()}-private-chat`,
    type: ChannelType.GuildText,
    // Exception: Access role can't see private chat
    exceptions: {
      access: { deny: [PermissionFlagsBits.ViewChannel] },
    },
  },
  {
    nameTemplate: (n: string) => `${n} VC`,
    type: ChannelType.GuildVoice,
    // No exceptions — inherits all category defaults
  },
  {
    nameTemplate: (n: string) => `${n} Private`,
    type: ChannelType.GuildVoice,
    // Exception: Access can't see Private VC
    exceptions: {
      access: { deny: [PermissionFlagsBits.ViewChannel] },
    },
  },
]

/**
 * Shared role names that get Send + Connect at the category level.
 * These roles control PARTICIPATION but NOT visibility.
 * Visibility is always controlled through Team or Access roles.
 */
const SHARED_ROLE_NAMES = ['Managers', 'Coaches', 'Team Captains', 'Trial Manager', 'Trial Coach']

/**
 * POST /api/discord/provision-team
 * One-click Discord provisioning: creates 2 roles, 1 category, 7 channels,
 * 6 default forum posts, and saves everything back to the team record.
 */
export async function POST(req: NextRequest) {
  try {
    const client = await ensureDiscordClient()
    if (!client) {
      return NextResponse.json({ error: 'Discord client not available' }, { status: 500 })
    }

    const guildId = process.env.DISCORD_GUILD_ID
    if (!guildId) {
      return NextResponse.json({ error: 'DISCORD_GUILD_ID not configured' }, { status: 500 })
    }

    const body = await req.json()
    const { teamId, emoji } = body

    if (!teamId) {
      return NextResponse.json({ error: 'teamId is required' }, { status: 400 })
    }

    const teamEmoji = emoji || '⚡'

    // 1. Fetch team data
    const payload = await getPayload({ config: configPromise })
    const team = await payload.findByID({ collection: 'teams', id: teamId, depth: 0 })
    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    }

    const teamName = team.name
    const primaryColor = team.brandingPrimary || '#888888'
    const accessColor = lightenColor(primaryColor, 0.2)

    const guild = await client.guilds.fetch(guildId)
    if (!guild) {
      return NextResponse.json({ error: 'Guild not found' }, { status: 404 })
    }

    // 2. Create roles
    console.log(`[Provision] Creating roles for team "${teamName}"...`)

    const teamRole = await guild.roles.create({
      name: `Team ${teamName}`,
      color: hexToInt(primaryColor),
      reason: `Provisioned via ELMT Admin for team: ${teamName}`,
    })
    await new Promise(r => setTimeout(r, 500))

    const accessRole = await guild.roles.create({
      name: `${teamName} Access`,
      color: hexToInt(accessColor),
      reason: `Provisioned via ELMT Admin for team: ${teamName}`,
    })
    await new Promise(r => setTimeout(r, 500))

    console.log(`[Provision] Roles created: ${teamRole.name} (${teamRole.id}), ${accessRole.name} (${accessRole.id})`)

    // 3. Resolve shared roles by exact name
    await guild.roles.fetch()
    const sharedRoles = SHARED_ROLE_NAMES.map(name => {
      const role = guild.roles.cache.find(r => r.name === name)
      if (role) {
        console.log(`[Provision] Found shared role: ${name} (${role.id})`)
      } else {
        console.warn(`[Provision] Shared role not found: "${name}" — skipping`)
      }
      return role
    }).filter(Boolean)

    // 4. Create category with base permissions
    //    @everyone:    deny ViewChannel (makes category private)
    //    Team role:    allow View, Send, Connect, threads
    //    Access role:  allow View, Send, Connect, threads
    //    Shared roles: allow Send, Connect, threads (NOT View)
    const categoryName = `${teamEmoji}|====== T. ${teamName} ======|${teamEmoji}`

    const categoryPerms: any[] = [
      {
        id: guild.roles.everyone.id,
        type: 0,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: teamRole.id,
        type: 0,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.SendMessagesInThreads,
          PermissionFlagsBits.CreatePublicThreads,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.Connect,
          PermissionFlagsBits.Speak,
        ],
      },
      {
        id: accessRole.id,
        type: 0,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.SendMessagesInThreads,
          PermissionFlagsBits.CreatePublicThreads,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.Connect,
          PermissionFlagsBits.Speak,
        ],
      },
    ]

    // Shared roles: Send + Connect (NOT View — view is tied to Team/Access assignment)
    for (const role of sharedRoles) {
      categoryPerms.push({
        id: role!.id,
        type: 0,
        allow: [
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.SendMessagesInThreads,
          PermissionFlagsBits.CreatePublicThreads,
          PermissionFlagsBits.Connect,
          PermissionFlagsBits.Speak,
        ],
      })
    }

    const category = await guild.channels.create({
      name: categoryName,
      type: ChannelType.GuildCategory,
      permissionOverwrites: categoryPerms,
      reason: `Provisioned via ELMT Admin for team: ${teamName}`,
    })
    await new Promise(r => setTimeout(r, 500))

    console.log(`[Provision] Category created: ${category.name} (${category.id})`)

    // 5. Create channels under the category
    //    Channels inherit category permissions by default.
    //    We only apply per-channel EXCEPTIONS where they differ.
    const createdChannels: Array<{ id: string; name: string; type: number }> = []
    const forumThreadIds: Record<string, string> = {}

    for (let i = 0; i < CHANNEL_DEFS.length; i++) {
      const def = CHANNEL_DEFS[i]
      const channelName = def.nameTemplate(teamName)

      // Create the channel inheriting category perms
      const channel = await guild.channels.create({
        name: channelName,
        type: def.type,
        parent: category.id,
        reason: `Provisioned via ELMT Admin for team: ${teamName}`,
      })

      // Apply per-channel permission exceptions (deny overrides on specific roles)
      if (def.exceptions) {
        if (def.exceptions.team) {
          const denyMap: Record<string, boolean> = {}
          for (const perm of def.exceptions.team.deny) {
            const permName = Object.entries(PermissionFlagsBits).find(([, v]) => v === perm)?.[0]
            if (permName) denyMap[permName] = false
          }
          await channel.permissionOverwrites.edit(teamRole.id, denyMap)
          await new Promise(r => setTimeout(r, 300))
        }

        if (def.exceptions.access) {
          const denyMap: Record<string, boolean> = {}
          for (const perm of def.exceptions.access.deny) {
            const permName = Object.entries(PermissionFlagsBits).find(([, v]) => v === perm)?.[0]
            if (permName) denyMap[permName] = false
          }
          await channel.permissionOverwrites.edit(accessRole.id, denyMap)
          await new Promise(r => setTimeout(r, 300))
        }
      }

      createdChannels.push({ id: channel.id, name: channel.name, type: channel.type })
      console.log(`[Provision] Channel created: ${channel.name} (${channel.id})${def.exceptions ? ' (with exceptions)' : ''}`)

      // 6. Create default forum posts if this is a forum channel
      if (def.forumPosts && (def.type === ChannelType.GuildForum)) {
        const postNames = def.forumPosts(teamName)
        for (const postName of postNames) {
          try {
            const thread = await (channel as any).threads.create({
              name: postName,
              message: { content: `${postName} — created automatically during team provisioning.` },
              reason: `Default forum post for team: ${teamName}`,
            })

            // Map specific posts to team thread ID fields
            const nameLower = postName.toLowerCase()
            if (nameLower.includes('availability')) {
              forumThreadIds.availabilityThreadId = thread.id
            } else if (nameLower.includes('calendar')) {
              forumThreadIds.calendarThreadId = thread.id
            } else if (nameLower.includes('schedule')) {
              forumThreadIds.scheduleThreadId = thread.id
            } else if (nameLower.includes('scrim codes')) {
              forumThreadIds.scrimCodesThreadId = thread.id
            }

            console.log(`[Provision] Forum post created: ${postName} (${thread.id})`)
            await new Promise(r => setTimeout(r, 500))
          } catch (err) {
            console.error(`[Provision] Failed to create forum post "${postName}":`, err)
          }
        }
      }

      // Rate limit protection
      await new Promise(r => setTimeout(r, 500))
    }

    // 7. Save everything back to the team record
    const updateData: Record<string, any> = {
      discordTeamRoleId: teamRole.id,
      discordAccessRoleId: accessRole.id,
      discordCategoryId: category.id,
      discordProvisioned: true,
      discordEmoji: teamEmoji,
    }

    // Save forum thread IDs to discordThreads group
    if (Object.keys(forumThreadIds).length > 0) {
      updateData.discordThreads = {
        ...(team.discordThreads as any || {}),
        ...forumThreadIds,
      }
    }

    await payload.update({
      collection: 'teams',
      id: teamId,
      data: updateData,
      context: { skipDiscordUpdate: true }, // Don't trigger team card refresh
    })

    console.log(`[Provision] Team record updated with Discord IDs`)

    return NextResponse.json({
      success: true,
      team: { id: teamId, name: teamName },
      roles: {
        team: { id: teamRole.id, name: teamRole.name, color: primaryColor },
        access: { id: accessRole.id, name: accessRole.name, color: accessColor },
      },
      category: { id: category.id, name: category.name },
      channels: createdChannels,
      forumThreadIds,
      sharedRolesApplied: sharedRoles.map(r => r!.name),
      colorInfo: {
        primary: primaryColor,
        accessColor,
        note: 'To set gradient colors in Discord: Server Settings → Roles → select role → Role Styles → Gradient',
      },
    })
  } catch (error: any) {
    console.error('[Provision] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 },
    )
  }
}
