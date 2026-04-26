import type { AssignedPlayer, DraftPick } from './types'

export const DRAFT_PICK_ORDER: Array<1 | 2> = [1, 2, 2, 1, 1, 2, 2, 1]

export function getNextPickTeam(pickNumber: number): 1 | 2 | null {
  if (pickNumber >= DRAFT_PICK_ORDER.length) return null
  return DRAFT_PICK_ORDER[pickNumber]
}

export function isDraftComplete(pickNumber: number): boolean {
  return pickNumber >= DRAFT_PICK_ORDER.length
}

export function applyPick(
  players: AssignedPlayer[],
  existingPicks: DraftPick[],
  pickedUserId: number,
  team: 1 | 2,
  pickNumber: number,
): AssignedPlayer[] {
  const alreadyPicked = existingPicks.some((p) => p.userId === pickedUserId)
  if (alreadyPicked) throw new Error(`Player ${pickedUserId} has already been picked`)

  const player = players.find((p) => p.userId === pickedUserId && p.team === null && !p.isCaptain)
  if (!player) throw new Error(`Player ${pickedUserId} is not in the undrafted pool`)

  return players.map((p) => p.userId === pickedUserId ? { ...p, team } : p)
}

export function getAutoPick(players: AssignedPlayer[]): number {
  const undrafted = players
    .filter((p) => p.team === null && !p.isCaptain)
    .sort((a, b) => b.rating - a.rating)

  if (undrafted.length === 0) throw new Error('No undrafted players available for auto-pick')
  return undrafted[0].userId
}
