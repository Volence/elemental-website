import { getPayload } from 'payload'
import configPromise from '@payload-config'

/**
 * The bot kill-switch lives on pug-seasons.botEnabled. The admin toggle flips
 * EVERY active season, so the switch is treated as global: the bot is on only
 * when no active season has it turned off. Defaults to on when nothing can be
 * read, so a failed lookup never silently disables the bot.
 */
export async function isBotEnabled(): Promise<boolean> {
  try {
    const payload = await getPayload({ config: configPromise })
    const result = await payload.find({
      collection: 'pug-seasons',
      where: { active: { equals: true } },
      overrideAccess: true,
      limit: 100,
    })
    return (result.docs as any[]).every((season) => season.botEnabled !== false)
  } catch {
    return true
  }
}

/**
 * Whether the bot should host a specific lobby: the global switch must be on
 * AND the lobby's own season (which may no longer be active) must not have it
 * off. Both the state machine and the lobby API use this so a lobby is never
 * painted as bot-hosted while the state machine skipped the bot.
 */
export async function isBotEnabledForLobby(lobby: { payloadSeasonId: number | null }): Promise<boolean> {
  if (!process.env.OW_BOT_SERVICE_URL) return false
  if (!(await isBotEnabled())) return false
  if (!lobby.payloadSeasonId) return true
  try {
    const payload = await getPayload({ config: configPromise })
    const season = (await payload.findByID({
      collection: 'pug-seasons',
      id: lobby.payloadSeasonId,
      overrideAccess: true,
    })) as any
    return season?.botEnabled !== false
  } catch {
    return true
  }
}
