/**
 * Hero name types and role mappings for Overwatch heroes.
 * Ported from parsertime (MIT license).
 */

export type HeroName =
  | 'Ana' | 'Anran' | 'Ashe' | 'Baptiste' | 'Bastion' | 'Brigitte'
  | 'Cassidy' | 'D.Mon' | 'D.Va' | 'Doctrine' | 'Domina' | 'Doomfist' | 'Echo' | 'Emre'
  | 'Freja' | 'Genji' | 'Hanzo' | 'Hazard' | 'Illari' | 'Jetpack Cat'
  | 'Junker Queen' | 'Junkrat' | 'Juno' | 'Kiriko' | 'Lifeweaver'
  | 'Lúcio' | 'Mauga' | 'Mei' | 'Mercy' | 'Mizuki' | 'Moira'
  | 'Orisa' | 'Pharah' | 'Ramattra' | 'Reaper' | 'Reinhardt'
  | 'Roadhog' | 'Shion' | 'Sierra' | 'Sigma' | 'Sojourn' | 'Soldier: 76' | 'Sombra'
  | 'Symmetra' | 'Torbjörn' | 'Tracer' | 'Vendetta' | 'Venture'
  | 'Widowmaker' | 'Winston' | 'Wrecking Ball' | 'Wuyang'
  | 'Zarya' | 'Zenyatta'

export type HeroRole = 'Tank' | 'Damage' | 'Support'

export const heroRoleMapping: Record<string, HeroRole> = {
  'Anran': 'Damage',
  'Ana': 'Support',
  'Ashe': 'Damage',
  'Baptiste': 'Support',
  'Bastion': 'Damage',
  'Brigitte': 'Support',
  'Cassidy': 'Damage',
  'D.Mon': 'Tank',
  'Doctrine': 'Support',
  'Domina': 'Tank',
  'Doomfist': 'Tank',
  'D.Va': 'Tank',
  'Echo': 'Damage',
  'Emre': 'Damage',
  'Freja': 'Damage',
  'Genji': 'Damage',
  'Hanzo': 'Damage',
  'Hazard': 'Tank',
  'Illari': 'Support',
  'Jetpack Cat': 'Support',
  'Junker Queen': 'Tank',
  'Junkrat': 'Damage',
  'Juno': 'Support',
  'Kiriko': 'Support',
  'Lifeweaver': 'Support',
  'Lúcio': 'Support',
  'Mauga': 'Tank',
  'Mei': 'Damage',
  'Mercy': 'Support',
  'Mizuki': 'Support',
  'Moira': 'Support',
  'Orisa': 'Tank',
  'Pharah': 'Damage',
  'Ramattra': 'Tank',
  'Reaper': 'Damage',
  'Reinhardt': 'Tank',
  'Roadhog': 'Tank',
  'Shion': 'Damage',
  'Sierra': 'Damage',
  'Sigma': 'Tank',
  'Sojourn': 'Damage',
  'Soldier: 76': 'Damage',
  'Sombra': 'Support',
  'Symmetra': 'Damage',
  'Torbjörn': 'Damage',
  'Tracer': 'Damage',
  'Vendetta': 'Damage',
  'Venture': 'Damage',
  'Widowmaker': 'Damage',
  'Winston': 'Tank',
  'Wrecking Ball': 'Tank',
  'Wuyang': 'Support',
  'Zarya': 'Tank',
  'Zenyatta': 'Support',
}

/**
 * Sombra moved from Damage to Support in Season 5. Her games from before then are a different
 * hero as far as stats go, so they are counted apart, under LEGACY_SOMBRA. Scrim dates are
 * stored as plain days, so the cutoff is a day too.
 */
export const SOMBRA_SUPPORT_SINCE = '2026-10-06'
export const LEGACY_SOMBRA = 'Sombra (Damage)'

function dayOf(playedAt: Date | string): string {
  return (typeof playedAt === 'string' ? new Date(playedAt) : playedAt).toISOString().slice(0, 10)
}

/** The stats name for a hero played on `playedAt`: pre-Season 5 Sombra is LEGACY_SOMBRA. */
export function heroKeyAt(hero: string, playedAt: Date | string | null | undefined): string {
  if (hero === 'Sombra' && playedAt && dayOf(playedAt) < SOMBRA_SUPPORT_SINCE) return LEGACY_SOMBRA
  return hero
}

/** The in-game hero behind a stats name, for portraits and icons. */
export function heroBaseName(key: string): string {
  return key === LEGACY_SOMBRA ? 'Sombra' : key
}

/**
 * Get the role for a hero name, defaulting to 'Damage' for unknown heroes. Pass when the game was
 * played to get the role the hero had then; a LEGACY_SOMBRA stats name is Damage either way.
 */
export function getRoleForHero(hero: string, playedAt?: Date | string | null): HeroRole {
  const key = playedAt === undefined ? hero : heroKeyAt(hero, playedAt)
  if (key === LEGACY_SOMBRA) return 'Damage'
  return heroRoleMapping[key] ?? 'Damage'
}
