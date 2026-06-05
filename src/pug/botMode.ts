import { getPayload } from 'payload'
import configPromise from '@payload-config'

/**
 * Returns whether the OW bot is enabled on the active PUG season.
 * Defaults to true (bot on) if the season cannot be read or the field is null,
 * so a failure to read the season does not accidentally disable the bot.
 */
export async function isBotEnabled(): Promise<boolean> {
  try {
    const payload = await getPayload({ config: configPromise })
    const result = await payload.find({
      collection: 'pug-seasons',
      where: { active: { equals: true } },
      overrideAccess: true,
      limit: 1,
    })
    const season = result.docs[0] as any
    if (!season) return true
    // If botEnabled is explicitly false, bot is disabled; otherwise default on
    return season.botEnabled !== false
  } catch {
    return true
  }
}
