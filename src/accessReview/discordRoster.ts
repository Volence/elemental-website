/**
 * Discord.js seeds the guild member cache with a partial list on GUILD_CREATE and the
 * logging module's full roster fetch is fire-and-forget. A non-empty cache is therefore
 * not a complete cache. Only trust it when it holds at least `memberCount` members;
 * otherwise callers must fetch, or report the check as unavailable rather than as
 * "these people left the server".
 */
export function isRosterComplete(cacheSize: number, memberCount: number | null | undefined): boolean {
  if (typeof memberCount !== 'number' || !Number.isFinite(memberCount) || memberCount <= 0) return false
  return cacheSize >= memberCount
}
