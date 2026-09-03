/**
 * PUG dashboard tab registry. Kept free of React components so editors can link
 * back to a tab without pulling the whole dashboard (and every tab) into their bundle.
 */
export type PugTabId =
  | 'lobbies'
  | 'settings'
  | 'invites'
  | 'moderation'
  | 'bot'
  | 'seasons'
  | 'players'
  | 'matches'
  | 'leaderboard'

export const PUG_DEFAULT_TAB: PugTabId = 'lobbies'

export const PUG_TAB_IDS: PugTabId[] = [
  'lobbies',
  'settings',
  'invites',
  'moderation',
  'bot',
  'seasons',
  'players',
  'matches',
  'leaderboard',
]

/** Where editors and other screens should link back to a given PUG tab. */
export function pugTabHref(tab: PugTabId): string {
  return tab === PUG_DEFAULT_TAB ? '/admin/pug-dashboard' : `/admin/pug-dashboard?tab=${tab}`
}
