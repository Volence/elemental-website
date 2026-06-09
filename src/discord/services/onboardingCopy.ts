import { type Guild } from 'discord.js'
import { ensureDiscordClient } from '@/discord/bot'

export interface SourceOption {
  title: string
  description: string | null
  emojiName: string | null
  emojiId: string | null
  roleNames: string[]
  channelNames: string[]
}
export interface SourcePrompt {
  title: string
  singleSelect: boolean
  required: boolean
  inOnboarding: boolean
  type: number
  options: SourceOption[]
}
export interface SourceOnboarding {
  enabled: boolean
  mode: number
  defaultChannelNames: string[]
  prompts: SourcePrompt[]
}

export interface RemappedOption {
  title: string
  description: string | null
  roles: string[]
  channels: string[]
  emoji?: string
}
export interface RemappedPrompt {
  title: string
  singleSelect: boolean
  required: boolean
  inOnboarding: boolean
  type: number
  options: RemappedOption[]
}
export interface RemappedOnboarding {
  enabled: boolean
  mode: number
  defaultChannels: string[]
  prompts: RemappedPrompt[]
}

function mapNames(names: string[], nameToId: Map<string, string>): string[] {
  const out: string[] = []
  for (const n of names) {
    const id = nameToId.get(n)
    if (id) out.push(id)
  }
  return out
}

/**
 * Translate a name-based onboarding snapshot into editOnboarding data for a target guild.
 * Role/channel references whose name is absent on the target are dropped. A custom emoji is
 * mapped to the target emoji of the same name, or dropped; a unicode emoji passes through.
 */
export function remapOnboarding(
  source: SourceOnboarding,
  roleNameToId: Map<string, string>,
  channelNameToId: Map<string, string>,
  emojiNameToId: Map<string, string>,
): RemappedOnboarding {
  return {
    enabled: source.enabled,
    mode: source.mode,
    defaultChannels: mapNames(source.defaultChannelNames, channelNameToId),
    prompts: source.prompts.map((p) => ({
      title: p.title,
      singleSelect: p.singleSelect,
      required: p.required,
      inOnboarding: p.inOnboarding,
      type: p.type,
      options: p.options.map((o) => {
        let emoji: string | undefined
        if (o.emojiId) {
          const targetId = emojiNameToId.get(o.emojiName ?? '')
          if (targetId) emoji = targetId
        } else if (o.emojiName) {
          emoji = o.emojiName
        }
        return {
          title: o.title,
          description: o.description,
          roles: mapNames(o.roleNames, roleNameToId),
          channels: mapNames(o.channelNames, channelNameToId),
          ...(emoji !== undefined ? { emoji } : {}),
        }
      })
        // Discord rejects an onboarding option with no roles AND no channels
        // (ROLE_OR_CHANNEL_REQUIRED). After remapping, an option whose every ref was
        // dropped (the source role/channel does not exist on the target) is removed.
        .filter((o) => o.roles.length > 0 || o.channels.length > 0),
    }))
      // A prompt with no remaining options is invalid, so drop it too.
      .filter((p) => p.options.length > 0),
  }
}

export interface CopyOnboardingResult {
  ok: boolean
  error?: string
  promptCount?: number
}

/** Read the primary guild's onboarding and copy it onto the target, remapping by name. */
export async function copyOnboarding(targetGuildId: string): Promise<CopyOnboardingResult> {
  const client = await ensureDiscordClient()
  if (!client) return { ok: false, error: 'Discord client not available' }
  const primaryGuildId = process.env.DISCORD_GUILD_ID
  if (!primaryGuildId) return { ok: false, error: 'DISCORD_GUILD_ID not configured' }
  if (targetGuildId === primaryGuildId) return { ok: false, error: 'Target cannot be the primary server' }

  const source: Guild = await client.guilds.fetch(primaryGuildId)
  const onboarding = await source.fetchOnboarding()
  const snapshot: SourceOnboarding = {
    enabled: onboarding.enabled,
    mode: onboarding.mode as unknown as number,
    defaultChannelNames: Array.from(onboarding.defaultChannels.values()).map((c) => c.name),
    prompts: Array.from(onboarding.prompts.values()).map((p) => ({
      title: p.title,
      singleSelect: p.singleSelect,
      required: p.required,
      inOnboarding: p.inOnboarding,
      type: p.type as unknown as number,
      options: Array.from(p.options.values()).map((o) => ({
        title: o.title,
        description: o.description,
        emojiName: o.emoji?.name ?? null,
        emojiId: o.emoji && 'id' in o.emoji ? ((o.emoji as any).id ?? null) : null,
        roleNames: Array.from(o.roles.values()).map((r) => r.name),
        channelNames: Array.from(o.channels.values()).map((c) => c.name),
      })),
    })),
  }

  const target: Guild = await client.guilds.fetch(targetGuildId)
  await target.roles.fetch()
  await target.channels.fetch()
  await target.emojis.fetch()
  const roleNameToId = new Map<string, string>()
  target.roles.cache.forEach((r) => roleNameToId.set(r.name, r.id))
  const channelNameToId = new Map<string, string>()
  target.channels.cache.forEach((c) => { if (c) channelNameToId.set(c.name, c.id) })
  const emojiNameToId = new Map<string, string>()
  target.emojis.cache.forEach((e) => { if (e.name) emojiNameToId.set(e.name, e.id) })

  const data = remapOnboarding(snapshot, roleNameToId, channelNameToId, emojiNameToId)

  try {
    await target.editOnboarding({
      enabled: data.enabled,
      mode: data.mode as any,
      defaultChannels: data.defaultChannels,
      prompts: data.prompts.map((p) => ({
        title: p.title,
        singleSelect: p.singleSelect,
        required: p.required,
        inOnboarding: p.inOnboarding,
        type: p.type as any,
        options: p.options.map((o) => ({
          title: o.title,
          description: o.description,
          roles: o.roles,
          channels: o.channels,
          ...(o.emoji !== undefined ? { emoji: o.emoji } : {}),
        })),
      })) as any,
      reason: 'Copied onboarding from primary server',
    })
    return { ok: true, promptCount: data.prompts.length }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'editOnboarding failed' }
  }
}
