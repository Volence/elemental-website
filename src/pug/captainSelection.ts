import type { AssignedPlayer, PugRole } from './types'

export type CaptainSelection = {
  captain1Id: number
  captain2Id: number
  captainRole: PugRole
}

export function selectCaptains(players: AssignedPlayer[]): CaptainSelection {
  const byRole: Record<string, AssignedPlayer[]> = {}
  for (const p of players) {
    if (!byRole[p.assignedRole]) byRole[p.assignedRole] = []
    byRole[p.assignedRole].push(p)
  }

  let bestRole: PugRole | null = null
  let bestCombined = -1

  for (const [role, pair] of Object.entries(byRole)) {
    if (pair.length !== 2) continue
    const combined = pair[0].rating + pair[1].rating
    if (combined > bestCombined) {
      bestCombined = combined
      bestRole = role as PugRole
    }
  }

  if (!bestRole) throw new Error('No valid captain pair found - role assignment malformed')

  const pair = byRole[bestRole].sort((a, b) => b.rating - a.rating)
  return {
    captain1Id: pair[0].userId,
    captain2Id: pair[1].userId,
    captainRole: bestRole,
  }
}
