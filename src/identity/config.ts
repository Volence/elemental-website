/** Create-time enforcement: every new People row must carry a Discord ID. Off until migration 3 has run. */
export function requireDiscordIdOnCreate(): boolean {
  return process.env.IDENTITY_REQUIRE_DISCORD_ID === 'true'
}

export const DISCORD_ID_RE = /^\d{17,19}$/
