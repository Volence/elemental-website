/**
 * Pure planning logic for the Discord clone tool.
 * No discord.js, no I/O — operates on plain serializable objects so it is unit-testable.
 * Permission bitfields are carried as decimal strings (BigInt-safe across JSON).
 */

export interface CloneRole {
  id: string
  name: string
  color: number
  position: number
  hoist: boolean
  mentionable: boolean
  permissions: string // decimal string of the bitfield
  managed: boolean
  isEveryone: boolean
}

export interface CloneOverwrite {
  roleId: string
  allow: string // decimal string
  deny: string // decimal string
}

export interface CloneChannel {
  id: string
  name: string
  type: number // discord.js ChannelType
  topic: string | null
  position: number
  overwrites: CloneOverwrite[]
}

export interface CloneCategory {
  id: string
  name: string
  position: number
  overwrites: CloneOverwrite[]
  channels: CloneChannel[]
}

export interface CloneEmoji {
  id: string
  name: string
  url: string
}

export interface CloneSticker {
  id: string
  name: string
  description: string | null
  tags: string
  url: string
}

export interface CloneSettings {
  verificationLevel: number
  defaultMessageNotifications: number
  explicitContentFilter: number
  systemChannelName: string | null
  rulesChannelName: string | null
}

export interface CloneSource {
  roles: CloneRole[]
  categories: CloneCategory[]
  emojis: CloneEmoji[]
  stickers: CloneSticker[]
  settings: CloneSettings
}

export interface CloneSelection {
  roleIds: string[]
  categoryIds: string[]
  channelIds: string[]
  includeEmojis: boolean
  includeStickers: boolean
  includeSettings: boolean
}

/** A filtered source: same shape minus settings, which may be nulled out by the selection. */
export interface FilteredSource extends Omit<CloneSource, 'settings'> {
  settings: CloneSettings | null
}

/**
 * Roles to actually create, excluding @everyone and managed (bot/integration) roles,
 * ordered highest-position-first so hierarchy matches the source when created top-down.
 */
export function orderRolesForStamp(roles: CloneRole[]): CloneRole[] {
  return roles
    .filter((r) => !r.isEveryone && !r.managed)
    .sort((a, b) => b.position - a.position)
}

/** Apply the admin's checkbox selection, producing a source containing only chosen items. */
export function filterSource(source: CloneSource, selection: CloneSelection): FilteredSource {
  const roleSet = new Set(selection.roleIds)
  const categorySet = new Set(selection.categoryIds)
  const channelSet = new Set(selection.channelIds)

  return {
    roles: source.roles.filter((r) => roleSet.has(r.id)),
    categories: source.categories
      .filter((c) => categorySet.has(c.id))
      .map((c) => ({
        ...c,
        channels: c.channels.filter((ch) => channelSet.has(ch.id)),
      })),
    emojis: selection.includeEmojis ? source.emojis : [],
    stickers: selection.includeStickers ? source.stickers : [],
    settings: selection.includeSettings ? source.settings : null,
  }
}

/**
 * Convert source overwrites into discord.js-ready overwrites for the target,
 * remapping old role ids to newly-created ones and DROPPING any overwrite whose
 * role was not copied (so it references nothing on the target).
 */
export function buildOverwrites(
  overwrites: CloneOverwrite[],
  roleIdMap: Map<string, string>,
): Array<{ id: string; allow: string; deny: string }> {
  const result: Array<{ id: string; allow: string; deny: string }> = []
  for (const ow of overwrites) {
    const newId = roleIdMap.get(ow.roleId)
    if (!newId) continue // role not copied -> drop this overwrite
    result.push({ id: newId, allow: ow.allow, deny: ow.deny })
  }
  return result
}

/** Case-insensitive name lookup for skip-by-name idempotency. */
export function findByName<T extends { name: string }>(items: T[], name: string): T | undefined {
  const lower = name.toLowerCase()
  return items.find((i) => i.name.toLowerCase() === lower)
}
