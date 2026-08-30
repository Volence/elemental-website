import type { RosterEntry } from './types'
import { rolePrimaryMatch } from './lineup-roles'

interface PlayerSlot {
  role: string
  playerId: string | null
  playerIds?: string[]
  isRinger?: boolean
  ringerName?: string
  isTrial?: boolean
}

interface TimeBlock {
  id: string
  time: string
  startTime?: string
  slots: PlayerSlot[]
  scrim?: any
}

interface DaySchedule {
  date: string
  isoDate?: string
  enabled: boolean
  blocks: TimeBlock[]
}

type PlayerStatus = 'main' | 'sub' | 'trial'

interface AvailablePlayer {
  personId: string
  discordId: string
  name: string
  scheduleRole: string
  rosterRole: string
  status: PlayerStatus
  availableBlocks: number
  blockStatus: 'available' | 'maybe'
}

const ROSTER_ROLE_MAP: Record<string, string> = {
  tank: 'Tank',
  dps: 'DPS',
  support: 'Support',
}

/** The manager's per-week status wins over roster membership. */
function resolveStatus(scheduleStatus: string | undefined, fallback: PlayerStatus): PlayerStatus {
  if (scheduleStatus === 'tryout') return 'trial'
  if (scheduleStatus === 'sub') return 'sub'
  if (scheduleStatus === 'main') return 'main'
  return fallback
}

export function suggestLineup(
  days: DaySchedule[],
  roster: RosterEntry[],
  subs: RosterEntry[],
  calendarResponses: any[],
): DaySchedule[] {
  const playerMap = new Map<string, { personId: string; name: string; rosterRole: string; lastScheduleRole?: string; status: PlayerStatus }>()
  for (const entry of roster) {
    if (entry.person?.discordId) {
      playerMap.set(entry.person.discordId, {
        personId: String(entry.person.id),
        name: entry.person.name || 'Unknown',
        rosterRole: entry.role,
        lastScheduleRole: entry.lastScheduleRole,
        status: 'main',
      })
    }
  }
  for (const entry of subs) {
    if (entry.person?.discordId && !playerMap.has(entry.person.discordId)) {
      playerMap.set(entry.person.discordId, {
        personId: String(entry.person.id),
        name: entry.person.name || 'Unknown',
        rosterRole: entry.role,
        lastScheduleRole: entry.lastScheduleRole,
        status: 'sub',
      })
    }
  }

  return days.map(day => {
    if (!day.enabled) return day

    const newBlocks = day.blocks.map(block => {
      const availablePlayers: AvailablePlayer[] = []

      for (const response of calendarResponses) {
        if (!response.selections) continue
        const playerInfo = playerMap.get(response.discordId)
        const scheduleRole = response.scheduleRole || (playerInfo ? (playerInfo.lastScheduleRole || ROSTER_ROLE_MAP[playerInfo.rosterRole]) : '') || ''

        let blockStatus: 'available' | 'maybe' | null = null
        let totalBlocksAvailable = 0

        for (const [dateKey, slots] of Object.entries(response.selections)) {
          const dateMatches = day.isoDate
            ? dateKey === day.isoDate
            : day.date.includes(dateKey) || dateKey === day.date
          if (!dateMatches) continue

          const daySlots = slots as Record<string, string>
          const blockMatchKey = block.startTime || block.time
          for (const [slotTime, status] of Object.entries(daySlots)) {
            if (status === 'available' || status === 'maybe') {
              totalBlocksAvailable++
              if (slotTime === blockMatchKey) {
                blockStatus = status as 'available' | 'maybe'
              }
            }
          }
        }

        if (blockStatus) {
          availablePlayers.push({
            personId: playerInfo?.personId || response.discordId,
            discordId: response.discordId,
            name: playerInfo?.name || response.discordUsername || 'Unknown',
            scheduleRole,
            rosterRole: playerInfo?.rosterRole || '',
            status: resolveStatus(response.scheduleStatus, playerInfo?.status || 'trial'),
            availableBlocks: totalBlocksAvailable,
            blockStatus,
          })
        }
      }

      availablePlayers.sort((a, b) => {
        if (a.blockStatus !== b.blockStatus) {
          return a.blockStatus === 'available' ? -1 : 1
        }
        if (a.status !== b.status) {
          if (a.status === 'main') return -1
          if (b.status === 'main') return 1
          if (a.status === 'sub') return -1
          if (b.status === 'sub') return 1
        }
        return b.availableBlocks - a.availableBlocks
      })

      // Count main and trial slots separately: a Hitscan trial row does not
      // make the main Hitscan slot a "duplicate" role.
      const roleCounts: Record<string, number> = {}
      for (const s of block.slots) {
        const key = `${s.isTrial ? 'trial:' : ''}${s.role}`
        roleCounts[key] = (roleCounts[key] || 0) + 1
      }

      const assignedIds = new Set<string>()
      const newSlots: PlayerSlot[] = [...block.slots]

      // Exact role matches only. Trial slots take trial players, main slots take everyone else.
      for (let i = 0; i < newSlots.length; i++) {
        const slot = newSlots[i]
        const confirmed = availablePlayers.filter(
          p => !assignedIds.has(p.personId) && p.blockStatus === 'available' && rolePrimaryMatch(p.scheduleRole, slot.role)
            && (slot.isTrial ? p.status === 'trial' : p.status !== 'trial')
        )
        if (confirmed.length > 0) {
          const key = `${slot.isTrial ? 'trial:' : ''}${slot.role}`
          const isUniqueRole = (roleCounts[key] || 0) <= 1
          if (isUniqueRole) {
            for (const m of confirmed) assignedIds.add(m.personId)
            const ids = confirmed.map(m => m.personId)
            newSlots[i] = { ...slot, playerId: ids[0], playerIds: ids }
          } else {
            assignedIds.add(confirmed[0].personId)
            newSlots[i] = { ...slot, playerId: confirmed[0].personId, playerIds: [confirmed[0].personId] }
          }
        }
      }

      return { ...block, slots: newSlots }
    })

    return { ...day, blocks: newBlocks }
  })
}
