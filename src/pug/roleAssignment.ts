import type { QueuedPlayer, AssignedPlayer, PugRole } from './types'

const ROLES: PugRole[] = ['tank', 'flex-dps', 'hitscan-dps', 'flex-support', 'main-support']
const SLOTS_PER_ROLE = 2

export function findValidAssignment(players: QueuedPlayer[]): AssignedPlayer[] | null {
  if (players.length < 10) return null

  const slotsFilled: Record<PugRole, number> = {
    'tank': 0, 'flex-dps': 0, 'hitscan-dps': 0, 'flex-support': 0, 'main-support': 0,
  }

  const assigned: AssignedPlayer[] = []

  function backtrack(playerIndex: number): boolean {
    if (assigned.length === 10) return true
    if (playerIndex >= players.length) return false

    const player = players[playerIndex]

    for (const role of player.queuedRoles) {
      if (slotsFilled[role] < SLOTS_PER_ROLE) {
        slotsFilled[role]++
        assigned.push({
          userId: player.userId,
          assignedRole: role,
          team: null,
          isCaptain: false,
          rating: player.rating,
        })

        if (backtrack(playerIndex + 1)) return true

        assigned.pop()
        slotsFilled[role]--
      }
    }

    return backtrack(playerIndex + 1)
  }

  return backtrack(0) ? assigned : null
}
