export type SpectatorInviteAction = 'INVITE_NOW' | 'PENDING_IN_GAME' | 'KEEP_PENDING'

const INVITABLE_STATUSES = ['lobby_created', 'invites_sent', 'players_joining']
const IN_GAME_STATUSES = ['game_started', 'game_ended']

// Decide what to do with a spectator given the bot's current state.
// INVITE_NOW: OW lobby is up and match not started, and we have an instance to call.
// PENDING_IN_GAME: match is live/ended - bot cannot invite without in-game OCR (out of scope).
// KEEP_PENDING: no lobby yet, or still setting up - invite later when it becomes invitable.
export function decideSpectatorInvite(
  botStatus: string | null,
  botInstanceId: string | null,
): SpectatorInviteAction {
  if (botStatus && IN_GAME_STATUSES.includes(botStatus)) return 'PENDING_IN_GAME'
  if (botInstanceId && botStatus && INVITABLE_STATUSES.includes(botStatus)) return 'INVITE_NOW'
  return 'KEEP_PENDING'
}

export { INVITABLE_STATUSES }
