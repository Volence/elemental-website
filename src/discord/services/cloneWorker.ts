import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { ChannelType, OverwriteType, type Guild } from 'discord.js'
import { ensureDiscordClient } from '@/discord/bot'
import { readCloneSource } from './cloneSource'
import {
  filterSource,
  orderRolesForStamp,
  buildOverwrites,
  findByName,
  type CloneSelection,
} from './clonePlan'

interface ReportItem {
  kind: 'role' | 'category' | 'channel' | 'emoji' | 'sticker' | 'settings'
  name: string
  outcome: 'created' | 'skipped' | 'failed'
  detail?: string
}

/**
 * Run a clone job end-to-end. Designed to be invoked WITHOUT await (fire-and-forget) from the
 * start route; the process is long-lived (the bot runs in-process), so the worker keeps running.
 * All progress and outcomes are persisted to the DiscordCloneJobs doc.
 */
export async function runCloneJob(jobId: string, targetGuildId: string, selection: CloneSelection): Promise<void> {
  const payload = await getPayload({ config: configPromise })
  const report: ReportItem[] = []
  const progress: Record<string, unknown> = { phase: 'starting' }

  const save = async (status: 'running' | 'completed' | 'failed', extra: Record<string, unknown> = {}) => {
    await payload.update({
      collection: 'discord-clone-jobs',
      id: jobId,
      data: { status, progress, report, ...extra } as any,
    })
  }

  try {
    await save('running')
    const client = await ensureDiscordClient()
    if (!client) throw new Error('Discord client not available')
    const target: Guild = await client.guilds.fetch(targetGuildId)
    await target.roles.fetch()
    await target.channels.fetch()

    const source = await readCloneSource()
    const filtered = filterSource(source, selection)

    // ---- Roles (top-down, skip-by-name) ----
    const rolesToStamp = orderRolesForStamp(filtered.roles)
    const roleIdMap = new Map<string, string>()
    progress.phase = 'roles'
    progress.rolesTotal = rolesToStamp.length
    progress.rolesDone = 0
    await save('running')

    for (const role of rolesToStamp) {
      const existing = findByName(Array.from(target.roles.cache.values()), role.name)
      if (existing) {
        roleIdMap.set(role.id, existing.id)
        report.push({ kind: 'role', name: role.name, outcome: 'skipped', detail: 'name exists' })
      } else {
        try {
          const created = await target.roles.create({
            name: role.name,
            color: role.color,
            hoist: role.hoist,
            mentionable: role.mentionable,
            permissions: BigInt(role.permissions),
            reason: 'Clone tool',
          })
          roleIdMap.set(role.id, created.id)
          report.push({ kind: 'role', name: role.name, outcome: 'created' })
        } catch (e: any) {
          report.push({ kind: 'role', name: role.name, outcome: 'failed', detail: e.message })
        }
      }
      progress.rolesDone = (progress.rolesDone as number) + 1
      await save('running')
    }

    // ---- Categories then channels (skip-by-name) ----
    const channelTotal = filtered.categories.reduce((n, c) => n + c.channels.length, 0)
    progress.phase = 'channels'
    progress.channelsTotal = channelTotal
    progress.channelsDone = 0
    await save('running')

    for (const category of filtered.categories) {
      let parentId: string | null = null
      if (category.id !== '__uncategorized__') {
        const existingCat = findByName(
          Array.from(target.channels.cache.values()).filter((c) => c?.type === ChannelType.GuildCategory) as any[],
          category.name,
        )
        if (existingCat) {
          parentId = existingCat.id
          report.push({ kind: 'category', name: category.name, outcome: 'skipped', detail: 'name exists' })
        } else {
          try {
            const createdCat = await target.channels.create({
              name: category.name,
              type: ChannelType.GuildCategory,
              permissionOverwrites: buildOverwrites(category.overwrites, roleIdMap).map((o) => ({
                id: o.id,
                allow: BigInt(o.allow),
                deny: BigInt(o.deny),
                type: OverwriteType.Role,
              })),
              reason: 'Clone tool',
            })
            parentId = createdCat.id
            report.push({ kind: 'category', name: category.name, outcome: 'created' })
          } catch (e: any) {
            report.push({ kind: 'category', name: category.name, outcome: 'failed', detail: e.message })
          }
        }
      }

      for (const channel of category.channels) {
        const existingCh = findByName(
          Array.from(target.channels.cache.values()).filter(
            (c) => c && c.type === channel.type,
          ) as any[],
          channel.name,
        )
        if (existingCh) {
          report.push({ kind: 'channel', name: channel.name, outcome: 'skipped', detail: 'name exists' })
        } else {
          try {
            await target.channels.create({
              name: channel.name,
              type: channel.type,
              parent: parentId ?? undefined,
              topic: channel.topic ?? undefined,
              permissionOverwrites: buildOverwrites(channel.overwrites, roleIdMap).map((o) => ({
                id: o.id,
                allow: BigInt(o.allow),
                deny: BigInt(o.deny),
                type: OverwriteType.Role,
              })),
              reason: 'Clone tool',
            })
            report.push({ kind: 'channel', name: channel.name, outcome: 'created' })
          } catch (e: any) {
            report.push({ kind: 'channel', name: channel.name, outcome: 'failed', detail: e.message })
          }
        }
        progress.channelsDone = (progress.channelsDone as number) + 1
        await save('running')
      }
    }

    // ---- Emojis ----
    if (filtered.emojis.length > 0) {
      progress.phase = 'emojis'
      await save('running')
      await target.emojis.fetch()
      for (const emoji of filtered.emojis) {
        if (findByName(Array.from(target.emojis.cache.values()).map((e) => ({ id: e.id, name: e.name ?? '' })), emoji.name)) {
          report.push({ kind: 'emoji', name: emoji.name, outcome: 'skipped', detail: 'name exists' })
          continue
        }
        try {
          await target.emojis.create({ attachment: emoji.url, name: emoji.name })
          report.push({ kind: 'emoji', name: emoji.name, outcome: 'created' })
        } catch (e: any) {
          report.push({ kind: 'emoji', name: emoji.name, outcome: 'failed', detail: e.message })
        }
      }
    }

    // ---- Stickers ----
    if (filtered.stickers.length > 0) {
      progress.phase = 'stickers'
      await save('running')
      await target.stickers.fetch()
      for (const sticker of filtered.stickers) {
        if (findByName(Array.from(target.stickers.cache.values()).map((s) => ({ id: s.id, name: s.name })), sticker.name)) {
          report.push({ kind: 'sticker', name: sticker.name, outcome: 'skipped', detail: 'name exists' })
          continue
        }
        try {
          await target.stickers.create({ file: sticker.url, name: sticker.name, tags: sticker.tags || 'sticker' })
          report.push({ kind: 'sticker', name: sticker.name, outcome: 'created' })
        } catch (e: any) {
          report.push({ kind: 'sticker', name: sticker.name, outcome: 'failed', detail: e.message })
        }
      }
    }

    // ---- Settings ----
    if (filtered.settings) {
      progress.phase = 'settings'
      await save('running')
      const s = filtered.settings
      try {
        await target.setVerificationLevel(s.verificationLevel as any)
        await target.setDefaultMessageNotifications(s.defaultMessageNotifications as any)
        await target.setExplicitContentFilter(s.explicitContentFilter as any)
        if (s.systemChannelName) {
          const sys = findByName(
            Array.from(target.channels.cache.values()).filter((c) => c?.type === ChannelType.GuildText) as any[],
            s.systemChannelName,
          )
          if (sys) await target.setSystemChannel(sys.id)
        }
        report.push({ kind: 'settings', name: 'server settings', outcome: 'created' })
      } catch (e: any) {
        report.push({ kind: 'settings', name: 'server settings', outcome: 'failed', detail: e.message })
      }
    }

    progress.phase = 'done'
    await save('completed')
  } catch (e: any) {
    console.error('Clone job failed:', e)
    await save('failed', { error: e.message || 'Unknown error' })
  }
}
