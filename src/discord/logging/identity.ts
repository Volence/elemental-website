const DISCORD_EPOCH_MS = 1420070400000

export function userMention(discordUserId: string): string {
  return `<@${discordUserId}>`
}

/**
 * Embed identity line: readable bold name FIRST, mention second. The name is always
 * legible even when the embed mention fails to render (embeds only resolve mentions
 * the viewer's client has cached); when it does render, the mention is the click
 * target that opens the in-server profile popout with roles.
 */
export function subjectLabel(tag: string, discordUserId: string): string {
  return `**${tag}** (${userMention(discordUserId)})`
}

/** Milliseconds-since-unix-epoch that the account (snowflake) was created. */
export function accountCreatedAtMs(snowflake: string): number {
  return Number((BigInt(snowflake) >> 22n) + BigInt(DISCORD_EPOCH_MS))
}

export function accountAgeDays(snowflake: string, nowMs: number): number {
  return Math.floor((nowMs - accountCreatedAtMs(snowflake)) / 86400000)
}

export function isNewAccount(snowflake: string, thresholdDays: number, nowMs: number): boolean {
  return accountAgeDays(snowflake, nowMs) < thresholdDays
}
