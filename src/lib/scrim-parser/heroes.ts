/**
 * Hero name types and role mappings for Overwatch heroes.
 * Ported from parsertime (MIT license).
 */

export type HeroName =
  | 'Ana' | 'Anran' | 'Ashe' | 'Baptiste' | 'Bastion' | 'Brigitte'
  | 'Cassidy' | 'D.Va' | 'Domina' | 'Doomfist' | 'Echo' | 'Emre'
  | 'Freja' | 'Genji' | 'Hanzo' | 'Hazard' | 'Illari' | 'Jetpack Cat'
  | 'Junker Queen' | 'Junkrat' | 'Juno' | 'Kiriko' | 'Lifeweaver'
  | 'Lúcio' | 'Mauga' | 'Mei' | 'Mercy' | 'Mizuki' | 'Moira'
  | 'Orisa' | 'Pharah' | 'Ramattra' | 'Reaper' | 'Reinhardt'
  | 'Roadhog' | 'Sigma' | 'Sojourn' | 'Soldier: 76' | 'Sombra'
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
  'Sigma': 'Tank',
  'Sojourn': 'Damage',
  'Soldier: 76': 'Damage',
  'Sombra': 'Damage',
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

/** Get the role for a hero name, defaulting to 'Damage' for unknown heroes */
export function getRoleForHero(hero: string): HeroRole {
  return heroRoleMapping[hero] ?? 'Damage'
}
