export const READY_CHECK_TIMEOUT_MS = 120_000
export const DRAFT_PICK_TIMEOUT_MS = 60_000
export const MAP_VOTE_TIMEOUT_MS = 60_000
export const BAN_TIMEOUT_MS = 60_000
export const RESULT_CONFIRM_TIMEOUT_MS = 120_000
export const VOICE_CLEANUP_TIMEOUT_MS = 7_200_000
export const DISPUTE_AFTER_COMPLETE_MS = 600_000
export const INVITE_TIER_LATE_CANCEL_MS = 900_000
export const AFK_TIMEOUT_MS = 14_400_000 // 4 hours - auto-kick idle players in OPEN lobbies

/**
 * Discord roles that can see, join and move people in every PUG voice channel.
 * Event Managers run the lobbies on the night and need to hop between team
 * channels and drag stragglers in. Override with a comma-separated
 * DISCORD_PUG_VOICE_STAFF_ROLE_IDS if the roles change.
 */
const EVENT_MANAGERS_ROLE_ID = '1380228748527276113'

export const PUG_VOICE_STAFF_ROLE_IDS: string[] = (process.env.DISCORD_PUG_VOICE_STAFF_ROLE_IDS ?? EVENT_MANAGERS_ROLE_ID)
  .split(',')
  .map((id) => id.trim())
  .filter((id) => /^\d{17,20}$/.test(id))

/** Voice channel players are handed back to when their match's team channels
 *  close and they were not moved in from a channel of their own (#pugs-general).
 *  Override with DISCORD_PUG_LOBBY_VOICE_CHANNEL_ID; set it empty to disable. */
export const PUG_LOBBY_VOICE_CHANNEL_ID: string = process.env.DISCORD_PUG_LOBBY_VOICE_CHANNEL_ID ?? '1512606971352584262'

/** Games a player needs this season before the public leaderboard ranks them.
 *  Below this their rating is still settling (new players start with high
 *  uncertainty, so a few early wins swing them far), and they are listed as
 *  provisional instead. */
export const PUG_RANKED_MIN_GAMES = 10
