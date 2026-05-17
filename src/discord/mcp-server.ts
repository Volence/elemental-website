#!/usr/bin/env npx tsx
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { REST } from '@discordjs/rest'
import {
  Routes,
  ChannelType,
  type APIGuild,
  type APIChannel,
  type APIMessage,
  type APIGuildMember,
  type APIRole,
  type APITextChannel,
} from 'discord-api-types/v10'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(import.meta.dirname, '../../.env.mcp') })

const TOKEN = process.env.DISCORD_BOT_TOKEN!
const GUILD_ID = process.env.DISCORD_GUILD_ID!

if (!TOKEN || !GUILD_ID) {
  console.error('DISCORD_BOT_TOKEN and DISCORD_GUILD_ID must be set')
  process.exit(1)
}

const rest = new REST({ version: '10' }).setToken(TOKEN)

const server = new McpServer({
  name: 'discord',
  version: '1.0.0',
})

// ── Helpers ──

function channelTypeName(type: number): string {
  const map: Record<number, string> = {
    [ChannelType.GuildText]: 'text',
    [ChannelType.GuildVoice]: 'voice',
    [ChannelType.GuildCategory]: 'category',
    [ChannelType.GuildAnnouncement]: 'announcement',
    [ChannelType.GuildForum]: 'forum',
    [ChannelType.GuildStageVoice]: 'stage',
    [ChannelType.PublicThread]: 'thread',
    [ChannelType.PrivateThread]: 'private-thread',
    [ChannelType.AnnouncementThread]: 'announcement-thread',
  }
  return map[type] ?? `type-${type}`
}

function json(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}

function text(msg: string) {
  return { content: [{ type: 'text' as const, text: msg }] }
}

// ── Tools ──

server.tool(
  'get_server_info',
  'Get Discord server overview: name, member count, channels, roles, boosts',
  {},
  async () => {
    const guild = (await rest.get(Routes.guild(GUILD_ID), {
      query: new URLSearchParams({ with_counts: 'true' }),
    })) as APIGuild
    const channels = (await rest.get(Routes.guildChannels(GUILD_ID))) as APIChannel[]

    const byType: Record<string, number> = {}
    for (const ch of channels) {
      const t = channelTypeName(ch.type)
      byType[t] = (byType[t] ?? 0) + 1
    }

    return json({
      name: guild.name,
      id: guild.id,
      memberCount: guild.approximate_member_count,
      onlineCount: guild.approximate_presence_count,
      boostLevel: guild.premium_tier,
      boostCount: guild.premium_subscription_count,
      channels: byType,
      totalChannels: channels.length,
    })
  },
)

server.tool(
  'list_channels',
  'List all channels in the server, optionally filtered by type (text, voice, category, forum, announcement, stage)',
  { type: z.string().optional().describe('Filter by channel type') },
  async ({ type }) => {
    const channels = (await rest.get(Routes.guildChannels(GUILD_ID))) as APIChannel[]

    let filtered = channels
    if (type) {
      filtered = channels.filter((ch) => channelTypeName(ch.type) === type)
    }

    const grouped: Record<string, Array<{ id: string; name: string; type: string; position: number }>> = {
      uncategorized: [],
    }
    const categories = new Map<string, string>()

    for (const ch of channels) {
      if (ch.type === ChannelType.GuildCategory) {
        categories.set(ch.id, ch.name!)
        if (!grouped[ch.name!]) grouped[ch.name!] = []
      }
    }

    for (const ch of filtered) {
      if (ch.type === ChannelType.GuildCategory) continue
      const parentId = 'parent_id' in ch ? ch.parent_id : null
      const catName = parentId ? categories.get(parentId) ?? 'uncategorized' : 'uncategorized'
      if (!grouped[catName]) grouped[catName] = []
      grouped[catName].push({
        id: ch.id,
        name: 'name' in ch ? ch.name ?? '' : '',
        type: channelTypeName(ch.type),
        position: 'position' in ch ? (ch.position ?? 0) : 0,
      })
    }

    for (const arr of Object.values(grouped)) {
      arr.sort((a, b) => a.position - b.position)
    }
    for (const key of Object.keys(grouped)) {
      if (grouped[key].length === 0) delete grouped[key]
    }

    return json(grouped)
  },
)

server.tool(
  'read_messages',
  'Read recent messages from a channel. Returns up to 50 messages with author, content, attachments, and reactions.',
  {
    channel_id: z.string().describe('Channel ID'),
    limit: z.number().optional().describe('Number of messages (1-50, default 25)'),
    before: z.string().optional().describe('Get messages before this message ID'),
    after: z.string().optional().describe('Get messages after this message ID'),
  },
  async ({ channel_id, limit, before, after }) => {
    const params = new URLSearchParams({ limit: String(Math.min(limit ?? 25, 50)) })
    if (before) params.set('before', before)
    if (after) params.set('after', after)

    const messages = (await rest.get(Routes.channelMessages(channel_id), {
      query: params,
    })) as APIMessage[]

    return json(
      messages.map((m) => ({
        id: m.id,
        author: m.author.global_name ?? m.author.username,
        authorId: m.author.id,
        isBot: m.author.bot ?? false,
        content: m.content,
        timestamp: m.timestamp,
        attachments: m.attachments.map((a) => ({ name: a.filename, url: a.url })),
        embeds: m.embeds.length,
        reactions: (m.reactions ?? []).map((r) => ({
          emoji: r.emoji.name,
          count: r.count,
        })),
        threadId: m.thread?.id,
      })),
    )
  },
)

server.tool(
  'send_message',
  'Send a message to a channel. Supports plain text and basic embeds.',
  {
    channel_id: z.string().describe('Channel ID'),
    content: z.string().optional().describe('Message text content'),
    embed_title: z.string().optional().describe('Embed title'),
    embed_description: z.string().optional().describe('Embed description'),
    embed_color: z.number().optional().describe('Embed color (decimal)'),
    reply_to: z.string().optional().describe('Message ID to reply to'),
  },
  async ({ channel_id, content, embed_title, embed_description, embed_color, reply_to }) => {
    const body: Record<string, unknown> = {}
    if (content) body.content = content
    if (embed_title || embed_description) {
      body.embeds = [
        {
          title: embed_title,
          description: embed_description,
          color: embed_color ?? 0x5865f2,
        },
      ]
    }
    if (reply_to) {
      body.message_reference = { message_id: reply_to }
    }

    const msg = (await rest.post(Routes.channelMessages(channel_id), { body })) as APIMessage
    return text(`Sent message ${msg.id} in <#${channel_id}>`)
  },
)

server.tool(
  'edit_message',
  'Edit a bot message in a channel',
  {
    channel_id: z.string().describe('Channel ID'),
    message_id: z.string().describe('Message ID to edit'),
    content: z.string().optional().describe('New message content'),
    embed_title: z.string().optional().describe('New embed title'),
    embed_description: z.string().optional().describe('New embed description'),
  },
  async ({ channel_id, message_id, content, embed_title, embed_description }) => {
    const body: Record<string, unknown> = {}
    if (content !== undefined) body.content = content
    if (embed_title || embed_description) {
      body.embeds = [{ title: embed_title, description: embed_description }]
    }
    await rest.patch(Routes.channelMessage(channel_id, message_id), { body })
    return text(`Edited message ${message_id}`)
  },
)

server.tool(
  'delete_message',
  'Delete a message from a channel',
  {
    channel_id: z.string().describe('Channel ID'),
    message_id: z.string().describe('Message ID to delete'),
  },
  async ({ channel_id, message_id }) => {
    await rest.delete(Routes.channelMessage(channel_id, message_id))
    return text(`Deleted message ${message_id}`)
  },
)

server.tool(
  'list_members',
  'List server members with roles. Returns up to 100 members.',
  {
    limit: z.number().optional().describe('Number of members (1-100, default 50)'),
    after: z.string().optional().describe('Get members after this user ID (for pagination)'),
  },
  async ({ limit, after }) => {
    const params = new URLSearchParams({ limit: String(Math.min(limit ?? 50, 100)) })
    if (after) params.set('after', after)

    const members = (await rest.get(Routes.guildMembers(GUILD_ID), {
      query: params,
    })) as APIGuildMember[]

    return json(
      members.map((m) => ({
        userId: m.user!.id,
        username: m.user!.username,
        displayName: m.nick ?? m.user!.global_name ?? m.user!.username,
        roles: m.roles,
        joinedAt: m.joined_at,
        isBot: m.user!.bot ?? false,
      })),
    )
  },
)

server.tool(
  'search_members',
  'Search server members by name',
  {
    query: z.string().describe('Search query (matches username and nickname)'),
    limit: z.number().optional().describe('Max results (1-100, default 10)'),
  },
  async ({ query, limit }) => {
    const params = new URLSearchParams({
      query,
      limit: String(Math.min(limit ?? 10, 100)),
    })
    const members = (await rest.get(Routes.guildMembersSearch(GUILD_ID), {
      query: params,
    })) as APIGuildMember[]

    return json(
      members.map((m) => ({
        userId: m.user!.id,
        username: m.user!.username,
        displayName: m.nick ?? m.user!.global_name ?? m.user!.username,
        roles: m.roles,
        joinedAt: m.joined_at,
      })),
    )
  },
)

server.tool(
  'list_roles',
  'List all roles in the server with member counts and permissions',
  {},
  async () => {
    const roles = (await rest.get(Routes.guildRoles(GUILD_ID))) as APIRole[]

    return json(
      roles
        .sort((a, b) => b.position - a.position)
        .map((r) => ({
          id: r.id,
          name: r.name,
          color: r.color ? `#${r.color.toString(16).padStart(6, '0')}` : null,
          position: r.position,
          mentionable: r.mentionable,
          managed: r.managed,
        })),
    )
  },
)

server.tool(
  'manage_member_roles',
  'Add or remove a role from a server member',
  {
    user_id: z.string().describe('User ID'),
    role_id: z.string().describe('Role ID'),
    action: z.enum(['add', 'remove']).describe('"add" or "remove"'),
  },
  async ({ user_id, role_id, action }) => {
    if (action === 'add') {
      await rest.put(Routes.guildMemberRole(GUILD_ID, user_id, role_id))
    } else {
      await rest.delete(Routes.guildMemberRole(GUILD_ID, user_id, role_id))
    }
    return text(`${action === 'add' ? 'Added' : 'Removed'} role ${role_id} ${action === 'add' ? 'to' : 'from'} user ${user_id}`)
  },
)

server.tool(
  'create_channel',
  'Create a new channel in the server',
  {
    name: z.string().describe('Channel name'),
    type: z.string().optional().describe('Channel type: text, voice, category, announcement, forum, stage'),
    parent_id: z.string().optional().describe('Category ID to place channel under'),
    topic: z.string().optional().describe('Channel topic/description'),
  },
  async ({ name, type, parent_id, topic }) => {
    const typeMap: Record<string, number> = {
      text: ChannelType.GuildText,
      voice: ChannelType.GuildVoice,
      category: ChannelType.GuildCategory,
      announcement: ChannelType.GuildAnnouncement,
      forum: ChannelType.GuildForum,
      stage: ChannelType.GuildStageVoice,
    }

    const body: Record<string, unknown> = {
      name,
      type: typeMap[type ?? 'text'] ?? ChannelType.GuildText,
    }
    if (parent_id) body.parent_id = parent_id
    if (topic) body.topic = topic

    const ch = (await rest.post(Routes.guildChannels(GUILD_ID), { body })) as APITextChannel
    return text(`Created channel #${ch.name} (${ch.id})`)
  },
)

server.tool(
  'edit_channel',
  'Edit a channel (name, topic, position, category, slowmode, nsfw)',
  {
    channel_id: z.string().describe('Channel ID'),
    name: z.string().optional().describe('New name'),
    topic: z.string().optional().describe('New topic'),
    parent_id: z.string().optional().describe('Move to category ID'),
    position: z.number().optional().describe('New position'),
    slowmode: z.number().optional().describe('Slowmode in seconds (0 to disable)'),
    nsfw: z.boolean().optional().describe('NSFW flag'),
  },
  async ({ channel_id, name, topic, parent_id, position, slowmode, nsfw }) => {
    const body: Record<string, unknown> = {}
    if (name !== undefined) body.name = name
    if (topic !== undefined) body.topic = topic
    if (parent_id !== undefined) body.parent_id = parent_id
    if (position !== undefined) body.position = position
    if (slowmode !== undefined) body.rate_limit_per_user = slowmode
    if (nsfw !== undefined) body.nsfw = nsfw

    await rest.patch(Routes.channel(channel_id), { body })
    return text(`Updated channel ${channel_id}`)
  },
)

server.tool(
  'delete_channel',
  'Delete a channel (irreversible)',
  { channel_id: z.string().describe('Channel ID') },
  async ({ channel_id }) => {
    const ch = (await rest.get(Routes.channel(channel_id))) as APIChannel
    await rest.delete(Routes.channel(channel_id))
    const name = 'name' in ch ? ch.name : channel_id
    return text(`Deleted channel #${name}`)
  },
)

server.tool(
  'get_channel_info',
  'Get detailed info about a specific channel including pins and metadata',
  { channel_id: z.string().describe('Channel ID') },
  async ({ channel_id }) => {
    const ch = (await rest.get(Routes.channel(channel_id))) as APIChannel & Record<string, unknown>
    const pins = (await rest.get(Routes.channelPins(channel_id))) as APIMessage[]

    return json({
      id: ch.id,
      name: 'name' in ch ? ch.name : null,
      type: channelTypeName(ch.type),
      topic: 'topic' in ch ? ch.topic : null,
      position: 'position' in ch ? ch.position : null,
      parentId: 'parent_id' in ch ? ch.parent_id : null,
      nsfw: 'nsfw' in ch ? ch.nsfw : false,
      slowmode: 'rate_limit_per_user' in ch ? ch.rate_limit_per_user : 0,
      pinnedMessages: pins.length,
      lastMessageId: 'last_message_id' in ch ? ch.last_message_id : null,
    })
  },
)

server.tool(
  'kick_member',
  'Kick a member from the server',
  {
    user_id: z.string().describe('User ID to kick'),
    reason: z.string().optional().describe('Reason for kick'),
  },
  async ({ user_id, reason }) => {
    await rest.delete(Routes.guildMember(GUILD_ID, user_id), { reason: reason ?? undefined })
    return text(`Kicked user ${user_id}`)
  },
)

server.tool(
  'ban_member',
  'Ban a member from the server',
  {
    user_id: z.string().describe('User ID to ban'),
    reason: z.string().optional().describe('Reason for ban'),
    delete_message_seconds: z.number().optional().describe('Seconds of message history to delete (0-604800)'),
  },
  async ({ user_id, reason, delete_message_seconds }) => {
    await rest.put(Routes.guildBan(GUILD_ID, user_id), {
      body: { delete_message_seconds: delete_message_seconds ?? 0 },
      reason: reason ?? undefined,
    })
    return text(`Banned user ${user_id}`)
  },
)

server.tool(
  'unban_member',
  'Remove a ban from a user',
  { user_id: z.string().describe('User ID to unban') },
  async ({ user_id }) => {
    await rest.delete(Routes.guildBan(GUILD_ID, user_id))
    return text(`Unbanned user ${user_id}`)
  },
)

server.tool(
  'timeout_member',
  'Timeout (mute) a member for a duration',
  {
    user_id: z.string().describe('User ID'),
    duration_minutes: z.number().describe('Timeout duration in minutes (0 to remove)'),
    reason: z.string().optional().describe('Reason'),
  },
  async ({ user_id, duration_minutes, reason }) => {
    const until =
      duration_minutes > 0 ? new Date(Date.now() + duration_minutes * 60_000).toISOString() : null

    await rest.patch(Routes.guildMember(GUILD_ID, user_id), {
      body: { communication_disabled_until: until },
      reason: reason ?? undefined,
    })

    return text(
      duration_minutes > 0
        ? `Timed out user ${user_id} for ${duration_minutes} minutes`
        : `Removed timeout from user ${user_id}`,
    )
  },
)

server.tool(
  'create_thread',
  'Create a thread in a channel',
  {
    channel_id: z.string().describe('Channel ID to create thread in'),
    name: z.string().describe('Thread name'),
    message_id: z.string().optional().describe('Message ID to start thread from (omit for standalone)'),
    auto_archive_duration: z.number().optional().describe('Auto-archive in minutes (60, 1440, 4320, 10080)'),
  },
  async ({ channel_id, name, message_id, auto_archive_duration }) => {
    let thread: any
    if (message_id) {
      thread = await rest.post(Routes.threads(channel_id, message_id), {
        body: { name, auto_archive_duration: auto_archive_duration ?? 1440 },
      })
    } else {
      thread = await rest.post(Routes.threads(channel_id), {
        body: { name, auto_archive_duration: auto_archive_duration ?? 1440, type: ChannelType.PublicThread },
      })
    }
    return text(`Created thread "${name}" (${thread.id})`)
  },
)

server.tool(
  'list_active_threads',
  'List active threads in the server, optionally filtered to a specific channel',
  { channel_id: z.string().optional().describe('Filter to threads in this channel') },
  async ({ channel_id }) => {
    const result = (await rest.get(Routes.guildActiveThreads(GUILD_ID))) as { threads: APIChannel[] }
    let threads = result.threads as any[]
    if (channel_id) {
      threads = threads.filter((t) => t.parent_id === channel_id)
    }
    return json(
      threads.map((t) => ({
        id: t.id,
        name: t.name,
        parentId: t.parent_id,
        messageCount: t.message_count,
        memberCount: t.member_count,
        archived: t.thread_metadata?.archived,
      })),
    )
  },
)

server.tool(
  'add_reaction',
  'Add a reaction emoji to a message',
  {
    channel_id: z.string().describe('Channel ID'),
    message_id: z.string().describe('Message ID'),
    emoji: z.string().describe('Emoji (unicode like 👍 or custom like name:id)'),
  },
  async ({ channel_id, message_id, emoji }) => {
    await rest.put(Routes.channelMessageOwnReaction(channel_id, message_id, encodeURIComponent(emoji)))
    return text(`Reacted with ${emoji}`)
  },
)

server.tool(
  'pin_message',
  'Pin or unpin a message in a channel',
  {
    channel_id: z.string().describe('Channel ID'),
    message_id: z.string().describe('Message ID'),
    action: z.enum(['pin', 'unpin']).describe('"pin" or "unpin"'),
  },
  async ({ channel_id, message_id, action }) => {
    if (action === 'pin') {
      await rest.put(Routes.channelPin(channel_id, message_id))
    } else {
      await rest.delete(Routes.channelPin(channel_id, message_id))
    }
    return text(`${action === 'pin' ? 'Pinned' : 'Unpinned'} message ${message_id}`)
  },
)

server.tool(
  'get_audit_log',
  'Get recent audit log entries for the server',
  {
    limit: z.number().optional().describe('Number of entries (1-50, default 20)'),
    action_type: z.number().optional().describe('Filter by action type number'),
    user_id: z.string().optional().describe('Filter by acting user ID'),
  },
  async ({ limit, action_type, user_id }) => {
    const params = new URLSearchParams({ limit: String(Math.min(limit ?? 20, 50)) })
    if (action_type !== undefined) params.set('action_type', String(action_type))
    if (user_id) params.set('user_id', user_id)

    const log = (await rest.get(Routes.guildAuditLog(GUILD_ID), { query: params })) as any
    return json(
      (log.audit_log_entries ?? []).map((e: any) => ({
        id: e.id,
        actionType: e.action_type,
        userId: e.user_id,
        targetId: e.target_id,
        reason: e.reason,
        changes: e.changes,
        createdAt: new Date(Number(BigInt(e.id) >> 22n) + 1420070400000).toISOString(),
      })),
    )
  },
)

server.tool(
  'manage_channel_permissions',
  'Set permission overrides for a role or user on a channel',
  {
    channel_id: z.string().describe('Channel ID'),
    target_id: z.string().describe('Role or user ID'),
    target_type: z.enum(['role', 'member']).describe('"role" or "member"'),
    allow: z.string().optional().describe('Allowed permission bits (as string number)'),
    deny: z.string().optional().describe('Denied permission bits (as string number)'),
  },
  async ({ channel_id, target_id, target_type, allow, deny }) => {
    await rest.put(Routes.channelPermission(channel_id, target_id), {
      body: { type: target_type === 'member' ? 1 : 0, allow: allow ?? '0', deny: deny ?? '0' },
    })
    return text(`Updated permissions for ${target_type} ${target_id} on channel ${channel_id}`)
  },
)

server.tool(
  'search_messages',
  'Search messages in the server. Can filter by author, content, channel, and more. Returns up to 25 messages sorted by most recent. Useful for checking when a user last posted.',
  {
    author_id: z.string().optional().describe('Filter by author user ID'),
    content: z.string().optional().describe('Search message content'),
    channel_id: z.string().optional().describe('Filter to a specific channel'),
    limit: z.number().optional().describe('Number of results (1-25, default 25)'),
    offset: z.number().optional().describe('Offset for pagination (default 0)'),
  },
  async ({ author_id, content, channel_id, limit, offset }) => {
    const params = new URLSearchParams()
    if (author_id) params.set('author_id', author_id)
    if (content) params.set('content', content)
    if (channel_id) params.set('channel_id', channel_id)
    params.set('sort_by', 'timestamp')
    params.set('sort_order', 'desc')
    params.set('limit', String(Math.min(limit ?? 25, 25)))
    if (offset) params.set('offset', String(offset))

    const result = (await rest.get(`/guilds/${GUILD_ID}/messages/search` as any, {
      query: params,
    })) as { messages: APIMessage[][]; total_results: number }

    return json({
      totalResults: result.total_results,
      messages: (result.messages ?? []).map((group) => {
        const m = group[0]
        return {
          id: m.id,
          author: m.author.global_name ?? m.author.username,
          authorId: m.author.id,
          channelId: m.channel_id,
          content: m.content.slice(0, 200),
          timestamp: m.timestamp,
        }
      }),
    })
  },
)

server.tool(
  'get_role_members',
  'Get all members who have a specific role. Paginates through the member list to find them.',
  {
    role_id: z.string().describe('Role ID to search for'),
  },
  async ({ role_id }) => {
    const found: Array<{ userId: string; username: string; displayName: string; joinedAt: string }> = []
    let after: string | undefined

    for (let i = 0; i < 30; i++) {
      const params = new URLSearchParams({ limit: '100' })
      if (after) params.set('after', after)

      const members = (await rest.get(Routes.guildMembers(GUILD_ID), {
        query: params,
      })) as APIGuildMember[]

      if (members.length === 0) break

      for (const m of members) {
        if (m.roles.includes(role_id)) {
          found.push({
            userId: m.user!.id,
            username: m.user!.username,
            displayName: m.nick ?? m.user!.global_name ?? m.user!.username,
            joinedAt: m.joined_at!,
          })
        }
      }

      after = members[members.length - 1].user!.id
      if (members.length < 100) break
    }

    return json({ count: found.length, members: found })
  },
)

// ── Start ──

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((err) => {
  console.error('MCP server failed:', err)
  process.exit(1)
})
