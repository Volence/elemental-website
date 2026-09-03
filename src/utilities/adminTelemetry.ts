/**
 * Pure helpers for admin page-view telemetry.
 *
 * The beacon in AdminProviders posts the current pathname on every client-side
 * navigation inside /admin. The API route records one row per view and, at most
 * once per throttle window per person, touches their active-sessions row so
 * "last activity" reflects real use rather than the moment they logged in.
 */

export const ADMIN_PATH_MAX_LENGTH = 200

/**
 * Reduce a raw pathname to something safe to store and aggregate:
 * - must start with /admin (anything else is ignored, returns null)
 * - query string and hash are dropped (they can carry ids and tokens)
 * - trailing slash removed except for the root
 * - numeric path segments are replaced with :id so /collections/teams/42 groups with /collections/teams/43
 * - over-long paths are ignored
 */
export function normalizeAdminPath(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  let path = raw.trim()
  const cut = path.search(/[?#]/)
  if (cut >= 0) path = path.slice(0, cut)
  if (!path.startsWith('/admin')) return null
  if (path.length > ADMIN_PATH_MAX_LENGTH) return null
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1)
  path = path
    .split('/')
    .map((segment) => (/^\d+$/.test(segment) ? ':id' : segment))
    .join('/')
  return path
}

export const ACTIVITY_TOUCH_THROTTLE_MS = 15 * 60 * 1000

/** True when enough time has passed since the last recorded touch for this person. */
export function shouldTouchActivity(
  lastTouchMs: number | undefined,
  nowMs: number,
  throttleMs: number = ACTIVITY_TOUCH_THROTTLE_MS,
): boolean {
  if (lastTouchMs === undefined) return true
  return nowMs - lastTouchMs >= throttleMs
}

export interface UsageSummary {
  days: number
  totalViews: number
  uniquePeople: number
  topPaths: Array<{ path: string; views: number; people: number }>
  byRole: Array<{ role: string; views: number; people: number }>
  perDay: Array<{ day: string; views: number }>
  topPeople: Array<{ personId: number | null; name: string | null; views: number; lastSeen: string }>
}

export const SUMMARY_WINDOWS_DAYS = [7, 30, 90] as const
export type SummaryWindowDays = (typeof SUMMARY_WINDOWS_DAYS)[number]

/** Coerce a ?days= query value to one of the supported windows, defaulting to 30. */
export function parseSummaryWindow(raw: string | null | undefined): SummaryWindowDays {
  const n = Number(raw)
  return (SUMMARY_WINDOWS_DAYS as readonly number[]).includes(n) ? (n as SummaryWindowDays) : 30
}
