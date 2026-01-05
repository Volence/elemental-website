import type { AutocompleteInteraction } from 'discord.js'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

// Cache teams to avoid slow database queries on every autocomplete
let cachedTeams: any[] = []
let cacheTimestamp = 0
const CACHE_TTL = 60 * 1000 // 1 minute cache

/**
 * Handle team name autocomplete
 */
export async function handleTeamAutocomplete(
  interaction: AutocompleteInteraction,
): Promise<void> {
  try {
    const focusedValue = interaction.options.getFocused().toLowerCase()

    // Use cached teams if available and fresh (< 1 minute old)
    const now = Date.now()
    if (cachedTeams.length === 0 || now - cacheTimestamp > CACHE_TTL) {
      // Fetch teams from database
      const payload = await getPayload({ config: configPromise })
      const teams = await payload.find({
        collection: 'teams',
        limit: 100, // Fetch all teams
        sort: 'name',
      })
      cachedTeams = teams.docs
      cacheTimestamp = now
    }

    // Filter teams by search term (case-insensitive)
    const filtered = cachedTeams.filter((team) =>
      team.name.toLowerCase().includes(focusedValue),
    )

    // Format for Discord autocomplete (limit to 25 after filtering)
    const choices = filtered.slice(0, 25).map((team) => ({
      name: team.name,
      value: team.slug || team.name.toLowerCase().replace(/\s+/g, '-'),
    }))

    await interaction.respond(choices)
  } catch (error) {
    console.error('Error handling team autocomplete:', error)
    // Always respond, even if empty, to avoid "Unknown interaction" error
    try {
      await interaction.respond([])
    } catch (respondError) {
      // Interaction already expired, log and move on
      console.error('Failed to respond to autocomplete (interaction expired):', respondError)
    }
  }
}
