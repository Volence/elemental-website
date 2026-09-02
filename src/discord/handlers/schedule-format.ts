// Pure formatting for the weekly schedule post. No Discord client here so it
// can be unit tested; publish-schedule.ts does the sending.

export const DISCORD_MESSAGE_LIMIT = 2000

export interface PlayerSlot {
  role: string
  playerId: string | null
  playerIds?: string[]
  isRinger?: boolean
  ringerName?: string
  isTrial?: boolean
}

export interface ScrimDetails {
  isScrim?: boolean
  opponentTeamId?: number | null
  opponent?: string
  opponentRoster?: string
  contact?: string
  host?: 'us' | 'them' | ''
  mapPool?: string
  heroBans?: boolean
  staggers?: boolean
  notes?: string
}

export interface TimeBlock {
  id: string
  time: string
  activity?: string
  slots: PlayerSlot[]
  scrim?: ScrimDetails
  reminderPosted?: boolean
}

export interface DaySchedule {
  date: string
  enabled: boolean
  useAllMembers?: boolean
  blocks: TimeBlock[]
  // Legacy single-block shape
  slots?: PlayerSlot[]
  scrim?: ScrimDetails & { time?: string }
}

export interface ScheduleData {
  days: DaySchedule[]
  lastUpdated?: string
}

const ACTIVITY_LABELS: Record<string, string> = {
  scrim: 'Scrim',
  match: 'Match',
  warmup: 'Warmup',
  vod: 'VOD Review',
  scouting: 'Scouting',
  other: 'Other',
}

export function getBlockActivity(block: TimeBlock): string {
  if (block.activity && block.activity !== 'free') return block.activity
  if (block.scrim?.isScrim || block.scrim?.opponent || block.scrim?.opponentTeamId) return 'scrim'
  return 'free'
}

function getPlayerIds(s: PlayerSlot): string[] {
  return s.playerIds?.length ? s.playerIds : s.playerId ? [s.playerId] : []
}

function formatBlock(day: DaySchedule, block: TimeBlock, index: number, blockCount: number, playerMap: Map<string, string>): string {
  const activity = getBlockActivity(block)
  const isScrimLike = activity === 'scrim' || activity === 'match' || activity === 'warmup'

  let text = blockCount > 1
    ? `**${day.date}** - Block ${index + 1} - ${block.time}\n`
    : `**${day.date}** - ${block.time}\n`

  text += '```\n'

  if (isScrimLike && block.scrim?.opponent) {
    const hostText = block.scrim.host === 'us' ? 'We host' : block.scrim.host === 'them' ? 'They host' : ''
    text += `vs ${block.scrim.opponent}${hostText ? ` - ${hostText}` : ''}\n\n`
  } else if (isScrimLike) {
    text += `Looking for ${ACTIVITY_LABELS[activity] || 'Scrim'}\n\n`
  } else {
    text += `${ACTIVITY_LABELS[activity] || activity}\n\n`
  }

  const mainSlots = block.slots.filter(s => !s.isTrial)
  const trialSlots = block.slots.filter(s => s.isTrial)
  const filledSlots = mainSlots.filter(s => getPlayerIds(s).length > 0 || (s.isRinger && s.ringerName))
  const totalSlots = mainSlots.length
  const maxRoleLen = Math.max(...mainSlots.map(s => (s.role || 'Role').length), 10)

  for (const slot of mainSlots) {
    let playerName = '-'
    if (slot.isRinger && slot.ringerName) {
      playerName = slot.ringerName === 'Ringer Needed' ? 'Ringer Needed' : `${slot.ringerName} (R)`
    } else {
      const ids = getPlayerIds(slot)
      if (ids.length > 0) playerName = ids.map(id => playerMap.get(id) || '?').join(', ')
    }
    text += `${(slot.role || 'Role').padEnd(maxRoleLen)}  ${playerName}\n`
  }

  const filledTrials = trialSlots.filter(s => getPlayerIds(s).length > 0)
  if (filledTrials.length > 0) {
    text += `\n--- Trials ---\n`
    for (const slot of filledTrials) {
      const playerName = getPlayerIds(slot).map(id => playerMap.get(id) || '?').join(', ')
      text += `${(slot.role || 'Role').padEnd(maxRoleLen)}  ${playerName}\n`
    }
  }

  if (filledSlots.length === totalSlots && totalSlots > 0) {
    text += `\nRoster confirmed\n`
  } else if (filledSlots.length > 0) {
    text += `\n${filledSlots.length}/${totalSlots} slots filled\n`
  }

  if (isScrimLike) {
    const settings: string[] = []
    if (block.scrim?.heroBans) settings.push('Hero Bans')
    if (block.scrim?.staggers) settings.push('Staggers')
    if (block.scrim?.mapPool) settings.push(`Maps: ${block.scrim.mapPool}`)
    if (settings.length > 0) text += `${settings.join(' | ')}\n`
    if (block.scrim?.contact) text += `Contact: ${block.scrim.contact}\n`
    if (block.scrim?.opponentRoster) text += `\n--- Their Roster ---\n${block.scrim.opponentRoster}\n`
  }

  if (block.scrim?.notes) text += `\n${block.scrim.notes}\n`

  text += '```'
  return text
}

/**
 * Turn a schedule into a header line plus one self-contained chunk per
 * non-free block. Chunks are the unit the packer may split messages on.
 */
export function formatScheduleChunks(
  schedule: ScheduleData,
  playerMap: Map<string, string>,
  pollName: string,
  timeSlot: string,
): { header: string; chunks: string[] } {
  const header = `**${pollName}**`
  const chunks: string[] = []

  for (const day of schedule.days.filter(d => d.enabled)) {
    let blocks: TimeBlock[] = []
    if (day.blocks && day.blocks.length > 0) {
      blocks = day.blocks
    } else if (day.slots) {
      blocks = [{
        id: 'legacy',
        time: day.scrim?.time || timeSlot,
        slots: day.slots,
        scrim: day.scrim ? { ...day.scrim, opponentTeamId: null } : undefined,
      }]
    }

    blocks = blocks.filter(b => getBlockActivity(b) !== 'free')
    blocks.forEach((block, i) => {
      chunks.push(formatBlock(day, block, i, blocks.length, playerMap))
    })
  }

  return { header, chunks }
}

/** Truncate a single oversized chunk while keeping its closing code fence. */
function truncateChunk(chunk: string, limit: number): string {
  if (chunk.length <= limit) return chunk
  const fence = '```'
  const marker = '\n... (truncated)\n' + fence
  const endsWithFence = chunk.trimEnd().endsWith(fence)
  const keep = limit - marker.length
  return endsWithFence ? chunk.slice(0, keep) + marker : chunk.slice(0, limit - 4) + '\n...'
}

/**
 * Pack chunks into as few Discord messages as possible without exceeding the
 * length limit. The header rides on the first message only.
 */
export function packDiscordMessages(header: string, chunks: string[], limit: number = DISCORD_MESSAGE_LIMIT): string[] {
  const sep = '\n\n'
  const messages: string[] = []
  let current = header

  for (const raw of chunks) {
    let chunk = raw
    let room = current ? limit - current.length - sep.length : limit
    if (chunk.length > room) {
      // Start a new message unless the only thing so far is the header;
      // the header should never be posted on its own.
      if (current && current !== header) {
        messages.push(current)
        current = ''
        room = limit
      }
      chunk = truncateChunk(chunk, room)
    }
    current = current ? current + sep + chunk : chunk
  }
  if (current) messages.push(current)
  return messages
}

export function formatScheduleMessages(
  schedule: ScheduleData,
  playerMap: Map<string, string>,
  pollName: string,
  timeSlot: string,
): string[] {
  const { header, chunks } = formatScheduleChunks(schedule, playerMap, pollName, timeSlot)
  if (chunks.length === 0) return [`${header}\n\nNothing scheduled this week.`]
  return packDiscordMessages(header, chunks)
}
