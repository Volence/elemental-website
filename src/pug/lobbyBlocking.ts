/** Lobby statuses that still hold a player - they cannot sit in two of these at once.
 *  DISPUTED is deliberately absent: the game is over, only the result is in question. */
export const ACTIVE_LOBBY_STATUSES = [
  'OPEN',
  'READY',
  'DRAFTING',
  'MAP_VOTE',
  'BANNING',
  'IN_PROGRESS',
  'REPORTING',
] as const

export type ActiveLobbyRef = { lobbyNumber?: number; status: string; pendingResult?: unknown }

/**
 * Whether a lobby the player already sits in should stop them opening another one.
 * REPORTING with a submitted result does not: that game is over bar the confirmation,
 * so they are free to queue for the next. Finished lobbies (including DISPUTED) never do.
 * The server guards and the PUG pages share this so they agree - a stricter check on
 * either side strands players between games.
 */
export function blocksNewLobby(lobby: ActiveLobbyRef | null | undefined): boolean {
  if (!lobby) return false
  if (!(ACTIVE_LOBBY_STATUSES as readonly string[]).includes(lobby.status)) return false
  if (lobby.status === 'REPORTING') {
    const pending = lobby.pendingResult as { reportedBy?: unknown } | null
    if (pending && pending.reportedBy) return false
  }
  return true
}
