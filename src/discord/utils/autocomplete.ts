import type { AutocompleteInteraction } from 'discord.js'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

/**
 * Handle team name autocomplete
 */
export async function handleTeamAutocomplete(
  interaction: AutocompleteInteraction,
): Promise<void> {
  try {
    const focusedValue = interaction.options.getFocused().toLowerCase()

    // Fetch teams from database (get all teams, not just 25)
    const payload = await getPayload({ config: configPromise })
    const teams = await payload.find({
      collection: 'teams',
      limit: 100, // Fetch all teams (Discord limit is 25 choices, but we filter after)
      sort: 'name',
    })

    // Filter teams by search term
    const filtered = teams.docs.filter((team) =>
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
    await interaction.respond([])
  }
}
