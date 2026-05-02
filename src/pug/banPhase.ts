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
  heroNames: Record<number, string> = {},
): void {
  const name = heroNames[heroId] ?? `hero ${heroId}`

  if (existingBans.some((b) => b.heroId === heroId)) {
    throw new Error(`${name} is already banned`)
  }

  const heroRole = heroRoles[heroId]
  if (!heroRole) throw new Error(`${name} not found`)

  const bansForRole = existingBans.filter((b) => heroRoles[b.heroId] === heroRole)

  const MAX_BANS_PER_ROLE = 2
  if (bansForRole.length >= MAX_BANS_PER_ROLE) {
    throw new Error(`Cannot ban ${name} - ${heroRole} ban limit (${MAX_BANS_PER_ROLE}) already reached`)
  }
}

export function applyBan(
  existingBans: BanRecord[],
  heroId: number,
  team: 1 | 2,
  heroRoles: HeroRoleMap,
  heroNames: Record<number, string> = {},
): BanRecord[] {
  validateBan(heroId, team, existingBans, heroRoles, heroNames)
  const banNumber = existingBans.length + 1
  return [...existingBans, { heroId, team, banNumber }]
}
