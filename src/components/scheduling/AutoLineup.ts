import type { RosterEntry } from './types'

interface PlayerSlot {
  role: string
  playerId: string | null
  isRinger?: boolean
  ringerName?: string
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

interface AvailablePlayer {
  personId: string
  discordId: string
  name: string
  scheduleRole: string
  rosterRole: string
  status: 'main' | 'sub' | 'trial'
  availableBlocks: number
}

const ROSTER_ROLE_MAP: Record<string, string> = {
  tank: 'Tank',
  dps: 'DPS',
  support: 'Support',
}

function roleMatchesSlot(scheduleRole: string, rosterRole: string, slotRole: string): boolean {
  if (scheduleRole && scheduleRole === slotRole) return true

  const role = rosterRole.toLowerCase()
  const slot = slotRole.toLowerCase()

  if (role === 'tank') return slot === 'tank'
  if (role === 'dps') return ['dps', 'hitscan', 'flex dps'].includes(slot)
  if (role === 'support') return ['support', 'main support', 'flex support'].includes(slot)
  return false
}

export function suggestLineup(
  days: DaySchedule[],
  roster: RosterEntry[],
  subs: RosterEntry[],
  calendarResponses: any[],
): DaySchedule[] {
  const playerMap = new Map<string, { personId: string; name: string; rosterRole: string; status: 'main' | 'sub' | 'trial' }>()
  for (const entry of roster) {
    if (entry.person?.discordId) {
      playerMap.set(entry.person.discordId, {
        personId: String(entry.person.id),
        name: entry.person.name || 'Unknown',
        rosterRole: entry.role,
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
        const scheduleRole = response.scheduleRole || (playerInfo ? ROSTER_ROLE_MAP[playerInfo.rosterRole] : '') || ''

        let isAvailableThisBlock = false
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
                isAvailableThisBlock = true
              }
            }
          }
        }

        if (isAvailableThisBlock) {
          availablePlayers.push({
            personId: playerInfo?.personId || response.discordId,
            discordId: response.discordId,
            name: playerInfo?.name || response.discordUsername || 'Unknown',
            scheduleRole,
            rosterRole: playerInfo?.rosterRole || '',
            status: playerInfo?.status || 'trial',
            availableBlocks: totalBlocksAvailable,
          })
        }
      }

      availablePlayers.sort((a, b) => {
        if (a.status !== b.status) {
          if (a.status === 'main') return -1
          if (b.status === 'main') return 1
          if (a.status === 'sub') return -1
          if (b.status === 'sub') return 1
        }
        return b.availableBlocks - a.availableBlocks
      })

      const assignedIds = new Set<string>()
      const newSlots: PlayerSlot[] = block.slots.map(slot => {
        const match = availablePlayers.find(
          p => !assignedIds.has(p.personId) && roleMatchesSlot(p.scheduleRole, p.rosterRole, slot.role)
        )

        if (match) {
          assignedIds.add(match.personId)
          return { ...slot, playerId: match.personId }
        }

        return { ...slot, playerId: null }
      })

      return { ...block, slots: newSlots }
    })

    return { ...day, blocks: newBlocks }
  })
}
