import { getDiscordClient } from '../bot'

export async function sendDm(discordUserId: string, content: string): Promise<void> {
  const client = getDiscordClient()
  if (!client || !discordUserId) return

  try {
    const user = await client.users.fetch(discordUserId)
    await user.send(content)
  } catch (err) {
    console.warn(`[PUG Notify] Could not DM user ${discordUserId}:`, err)
  }
}

export function formatUserPings(discordUserIds: string[]): string {
  return discordUserIds.map((id) => `<@${id}>`).join(' ')
}
