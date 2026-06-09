const DISCORD_EPOCH_MS = 1420070400000

export function userMention(discordUserId: string): string {
  return `<@${discordUserId}>`
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
