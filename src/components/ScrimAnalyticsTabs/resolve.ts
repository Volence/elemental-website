export type ScrimTab = 'dashboard' | 'scrims' | 'teams' | 'upload' | 'players' | 'heroes'

export const SCRIM_TAB_HREFS: Record<ScrimTab, string> = {
  dashboard: '/admin/scrim-dashboard',
  scrims: '/admin/scrims',
  teams: '/admin/scrim-teams',
  upload: '/admin/scrim-upload',
  players: '/admin/scrim-players',
  heroes: '/admin/scrim-heroes',
}

/**
 * Which top-level scrim tab a pathname belongs to. Derived from the URL so the
 * bar can never disagree with the page it sits on (the landing page used to
 * highlight "Scrims" while linking elsewhere).
 */
export function resolveScrimTab(pathname: string | null | undefined): ScrimTab {
  const p = (pathname ?? '').replace(/\/+$/, '')
  if (p === '/admin/scrim-dashboard') return 'dashboard'
  if (p === '/admin/scrim-teams' || p === '/admin/scrim-team') return 'teams'
  if (p === '/admin/scrim-upload') return 'upload'
  if (p === '/admin/scrim-players' || p === '/admin/scrim-player-detail') return 'players'
  if (p === '/admin/scrim-heroes') return 'heroes'
  // /admin/scrims, /admin/scrim, /admin/scrim-map and anything else under scrims
  return 'scrims'
}
