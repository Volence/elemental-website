// Pure helpers shared by the lineup builder UI and the auto-suggest logic.
// Kept free of React so they can be unit tested directly.

export interface LineupSlot {
  role: string
  playerId: string | null
  playerIds?: string[]
  isRinger?: boolean
  ringerName?: string
  isTrial?: boolean
}

export interface LineupBlock {
  id: string
  time: string
  startTime?: string
  activity?: string
  slots: LineupSlot[]
  scrim?: { opponent?: string; opponentTeamId?: number | null; isScrim?: boolean }
  outcome?: object
}

export interface LineupDay {
  date: string
  isoDate?: string
  enabled: boolean
  blocks: LineupBlock[]
}

export const ROLE_FAMILY: Record<string, string[]> = {
  tank: ['tank'],
  dps: ['dps', 'hitscan', 'flex dps'],
  support: ['support', 'main support', 'flex support'],
}

export const BROAD_ROLES = new Set(['tank', 'dps', 'support'])

/** True when a player's chosen role should fill the given slot role outright.
 *  Exact match, or a broad role (DPS) against any member of its family (Hitscan). */
export function rolePrimaryMatch(playerRole: string, slotRole: string): boolean {
  const pr = (playerRole || '').toLowerCase()
  const sr = (slotRole || '').toLowerCase()
  if (!pr || !sr) return false
  if (pr === sr) return true
  if (BROAD_ROLES.has(pr)) {
    for (const family of Object.values(ROLE_FAMILY)) {
      if (family.includes(pr) && family.includes(sr)) return true
    }
  }
  return false
}

/** Looser match: same family in either direction (Flex DPS player for a Hitscan slot). */
export function roleMatchesFamily(playerRole: string, slotRole: string): boolean {
  if (rolePrimaryMatch(playerRole, slotRole)) return true
  const pr = (playerRole || '').toLowerCase()
  const sr = (slotRole || '').toLowerCase()
  for (const family of Object.values(ROLE_FAMILY)) {
    if (family.includes(pr) && family.includes(sr)) return true
  }
  return false
}

export function getSlotPlayerIds(slot: LineupSlot): string[] {
  if (slot.playerIds?.length) return slot.playerIds
  if (slot.playerId) return [slot.playerId]
  return []
}

/**
 * Which of the team's preset roles need a Trial row. A trial player's role is
 * mapped onto the preset rows the same way main players are (a generic "DPS"
 * trial opens both Hitscan and Flex DPS trial rows), so trials never end up
 * with no row at all under the specific preset.
 */
export function computeTrialRoles(
  entries: { role: string; scheduleStatus: string }[],
  roles: string[],
): Set<string> {
  const trialPlayerRoles = new Set<string>()
  for (const e of entries) {
    if (e.scheduleStatus === 'tryout' && e.role) trialPlayerRoles.add(e.role)
  }
  const out = new Set<string>()
  if (trialPlayerRoles.size === 0) return out
  for (const role of roles) {
    if (role === 'Coach' || role === 'Sub') continue
    for (const pr of trialPlayerRoles) {
      if (rolePrimaryMatch(pr, role)) {
        out.add(role)
        break
      }
    }
  }
  return out
}

/**
 * Ensure every block has one trial slot per trial role, inserted directly
 * after that role's main slot. Returns the same array reference (changed=false)
 * when nothing needed inserting so callers can skip a state update.
 */
export function withTrialSlots<D extends LineupDay>(days: D[], trialRoles: Set<string>): { days: D[]; changed: boolean } {
  if (trialRoles.size === 0 || days.length === 0) return { days, changed: false }
  let changed = false
  const next = days.map(d => {
    let dayChanged = false
    const blocks = d.blocks.map(block => {
      const missing: LineupSlot[] = []
      for (const role of trialRoles) {
        if (!block.slots.some(s => s.role === role && s.isTrial)) {
          missing.push({ role, playerId: null, playerIds: [], isTrial: true })
        }
      }
      if (missing.length === 0) return block
      dayChanged = true
      const slots: LineupSlot[] = []
      for (const s of block.slots) {
        slots.push(s)
        if (!s.isTrial) {
          const forRole = missing.filter(m => m.role === s.role)
          for (const m of forRole) {
            slots.push(m)
            missing.splice(missing.indexOf(m), 1)
          }
        }
      }
      slots.push(...missing)
      return { ...block, slots }
    })
    if (!dayChanged) return d
    changed = true
    return { ...d, blocks }
  })
  return changed ? { days: next, changed } : { days, changed: false }
}

/** Anything a manager would be upset to lose on reload. */
export function scheduleHasContent(days: LineupDay[]): boolean {
  for (const d of days) {
    for (const b of d.blocks || []) {
      if (b.activity && b.activity !== 'free') return true
      if (b.scrim?.opponent || b.scrim?.opponentTeamId || b.scrim?.isScrim) return true
      if (b.outcome && Object.keys(b.outcome).length > 0) return true
      for (const s of b.slots || []) {
        if (getSlotPlayerIds(s).length > 0) return true
        if (s.isRinger && s.ringerName) return true
      }
    }
  }
  return false
}

/**
 * Set the players on one slot of a block. A player can only hold one slot per
 * block, so anyone newly placed here is pulled out of the block's other slots.
 * Assigning a real player also clears a ringer placeholder on that slot.
 */
export function setSlotPlayers<B extends LineupBlock>(block: B, slotIdx: number, playerIds: string[]): B {
  const target = block.slots[slotIdx]
  if (!target) return block
  const before = new Set(getSlotPlayerIds(target))
  const added = playerIds.filter(id => !before.has(id))
  const slots = block.slots.map((slot, si) => {
    if (si === slotIdx) {
      const next: LineupSlot = { ...slot, playerIds, playerId: playerIds[0] || null }
      if (playerIds.length > 0 && slot.isRinger) {
        next.isRinger = false
        next.ringerName = ''
      }
      return next
    }
    if (added.length === 0) return slot
    const current = getSlotPlayerIds(slot)
    if (!current.some(id => added.includes(id))) return slot
    const remaining = current.filter(id => !added.includes(id))
    return { ...slot, playerIds: remaining, playerId: remaining[0] || null }
  })
  return { ...block, slots }
}

/** Toggle one player on a slot, keeping the one-slot-per-block invariant. */
export function toggleSlotPlayer<B extends LineupBlock>(block: B, slotIdx: number, playerId: string): B {
  const slot = block.slots[slotIdx]
  if (!slot) return block
  const current = getSlotPlayerIds(slot)
  const next = current.includes(playerId) ? current.filter(id => id !== playerId) : [...current, playerId]
  return setSlotPlayers(block, slotIdx, next)
}
