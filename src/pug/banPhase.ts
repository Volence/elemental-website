import type { BanRecord } from './types'

export type HeroRole = 'tank' | 'dps' | 'support'
export type HeroRoleMap = Record<number, HeroRole>

export const BAN_ORDER: Array<1 | 2> = [2, 1, 2, 1]

export function getNextBanTeam(banNumber: number): 1 | 2 | null {
  if (banNumber > BAN_ORDER.length) return null
  return BAN_ORDER[banNumber - 1]
}

export function validateBan(
  heroId: number,
  team: 1 | 2,
  existingBans: BanRecord[],
  heroRoles: HeroRoleMap,
): void {
  if (existingBans.some((b) => b.heroId === heroId)) {
    throw new Error(`Hero ${heroId} is already banned`)
  }

  const heroRole = heroRoles[heroId]
  if (!heroRole) throw new Error(`Hero ${heroId} not found in role map`)

  const bansForRole = existingBans.filter((b) => heroRoles[b.heroId] === heroRole)

  const MAX_BANS_PER_ROLE = 2
  if (bansForRole.length >= MAX_BANS_PER_ROLE) {
    throw new Error(`Cannot ban hero ${heroId}: role ban cap (${MAX_BANS_PER_ROLE}) reached for ${heroRole}`)
  }
}

export function applyBan(
  existingBans: BanRecord[],
  heroId: number,
  team: 1 | 2,
  heroRoles: HeroRoleMap,
): BanRecord[] {
  validateBan(heroId, team, existingBans, heroRoles)
  const banNumber = existingBans.length + 1
  return [...existingBans, { heroId, team, banNumber }]
}
