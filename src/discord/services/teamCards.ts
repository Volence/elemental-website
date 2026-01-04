import type { EmbedBuilder, TextChannel } from 'discord.js'
import { getDiscordClient } from '../bot'
import { buildTeamEmbed, buildStaffEmbed } from '../utils/embeds'
import type { Team } from '@/payload-types'

export interface TeamCardOptions {
  teamId: string | number
  forceRepost?: boolean
}

/**
 * Post or update a team card in the Discord cards channel
 */
export async function postOrUpdateTeamCard(options: TeamCardOptions): Promise<string | null> {
  const { teamId, forceRepost = false } = options

  try {
    const client = getDiscordClient()
    if (!client) {
      console.log('Discord client not available')
      return null
    }

    const channelId = process.env.DISCORD_CARDS_CHANNEL
    if (!channelId) {
      console.log('DISCORD_CARDS_CHANNEL not configured')
      return null
    }

    // Fetch team data from database
    const team = await fetchTeamData(teamId)
    if (!team) {
      console.log(`Team ${teamId} not found`)
      return null
    }

    // Get the Discord channel
    const channel = (await client.channels.fetch(channelId)) as TextChannel
    if (!channel || !channel.isTextBased()) {
      console.log(`Channel ${channelId} not found or not a text channel`)
      return null
    }

    // Build the team embed
    const embed = await buildTeamEmbed(team)

    // Check if team already has a card posted
    const existingMessageId = team.discordCardMessageId

    if (existingMessageId && !forceRepost) {
      // Try to edit existing message
      try {
        const message = await channel.messages.fetch(existingMessageId)
        await message.edit({ embeds: [embed] })
        console.log(`✅ Updated team card for ${team.name}`)
        return existingMessageId
      } catch (error) {
        console.log(`Message ${existingMessageId} not found, will repost`)
      }
    }

    // Post new message
    const message = await channel.send({ embeds: [embed] })
    console.log(`✅ Posted new team card for ${team.name}`)

    // Save message ID to database
    await saveTeamMessageId(teamId, message.id)

    return message.id
  } catch (error) {
    console.error('Error posting/updating team card:', error)
    return null
  }
}

/**
 * Refresh all team cards in order: Staff first, then teams by region/SR
 */
export async function refreshAllTeamCards(): Promise<void> {
  try {
    const client = getDiscordClient()
    if (!client) {
      console.log('Discord client not available')
      return
    }

    const channelId = process.env.DISCORD_CARDS_CHANNEL
    if (!channelId) {
      console.log('DISCORD_CARDS_CHANNEL not configured')
      return
    }

    const channel = (await client.channels.fetch(channelId)) as TextChannel
    if (!channel || !channel.isTextBased()) {
      console.log(`Channel ${channelId} not found or not a text channel`)
      return
    }

    console.log('🔄 Refreshing all team cards...')

    // Step 1: Delete all existing team card messages (keep staff cards)
    await deleteAllTeamCardMessages(channel)

    // Step 2: Post staff cards
    await postStaffCards(channel)

    // Step 3: Fetch and sort all teams
    const teams = await fetchAllTeamsSorted()

    // Step 4: Post team cards in order
    for (const team of teams) {
      const embed = await buildTeamEmbed(team)
      const message = await channel.send({ embeds: [embed] })
      await saveTeamMessageId(team.id, message.id)
      console.log(`✅ Posted card for ${team.name}`)

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500))
    }

    console.log(`✅ Refreshed ${teams.length} team cards + staff cards`)
  } catch (error) {
    console.error('Error refreshing all team cards:', error)
  }
}

/**
 * Delete all team card messages from the channel
 */
async function deleteAllTeamCardMessages(channel: TextChannel): Promise<void> {
  try {
    // Fetch all teams with message IDs
    const payload = (await import('payload')).default
    const teams = await payload.find({
      collection: 'teams',
      where: {
        discordCardMessageId: {
          exists: true,
        },
      },
      limit: 1000,
    })

    // Delete each message
    for (const team of teams.docs) {
      if (team.discordCardMessageId) {
        try {
          const message = await channel.messages.fetch(team.discordCardMessageId)
          await message.delete()
        } catch (error) {
          // Message might already be deleted, that's ok
        }
      }
    }

    console.log(`🗑️  Deleted ${teams.docs.length} team card messages`)
  } catch (error) {
    console.error('Error deleting team card messages:', error)
  }
}

/**
 * Post staff department cards
 */
async function postStaffCards(channel: TextChannel): Promise<void> {
  try {
    const payload = (await import('payload')).default

    // Get all production staff
    const production = await payload.find({
      collection: 'production',
      limit: 100,
    })

    if (production.docs.length > 0) {
      const embed = buildStaffEmbed('Production Staff', production.docs)
      await channel.send({ embeds: [embed] })
      console.log('✅ Posted Production Staff card')
    }

    // Get all organization staff
    const organization = await payload.find({
      collection: 'organization-staff',
      limit: 100,
    })

    if (organization.docs.length > 0) {
      const embed = buildStaffEmbed('Organization Staff', organization.docs)
      await channel.send({ embeds: [embed] })
      console.log('✅ Posted Organization Staff card')
    }
  } catch (error) {
    console.error('Error posting staff cards:', error)
  }
}

/**
 * Fetch all teams sorted by region and SR (descending)
 */
async function fetchAllTeamsSorted(): Promise<any[]> {
  try {
    const payload = (await import('payload')).default
    const result = await payload.find({
      collection: 'teams',
      limit: 1000,
      sort: 'region', // Sort by region first
    })

    // Group by region, then sort by SR within each region
    const teamsByRegion = new Map<string, any[]>()

    for (const team of result.docs) {
      const region = team.region || 'Unknown'
      if (!teamsByRegion.has(region)) {
        teamsByRegion.set(region, [])
      }
      teamsByRegion.get(region)!.push(team)
    }

    // Sort teams within each region by competitive rating (SR) descending
    for (const [region, teams] of teamsByRegion.entries()) {
      teams.sort((a, b) => {
        const aRating = a.competitiveRating || 0
        const bRating = b.competitiveRating || 0
        return bRating - aRating // Descending order
      })
    }

    // Flatten back to single array, maintaining region grouping
    const sorted: any[] = []
    for (const teams of teamsByRegion.values()) {
      sorted.push(...teams)
    }

    return sorted
  } catch (error) {
    console.error('Error fetching teams:', error)
    return []
  }
}

/**
 * Fetch team data from database
 */
async function fetchTeamData(teamId: string | number): Promise<any | null> {
  try {
    const payload = (await import('payload')).default
    const team = await payload.findByID({
      collection: 'teams',
      id: teamId,
    })
    return team
  } catch (error) {
    console.error('Error fetching team:', error)
    return null
  }
}

/**
 * Save Discord message ID to team document
 */
async function saveTeamMessageId(teamId: string | number, messageId: string): Promise<void> {
  try {
    const payload = (await import('payload')).default
    await payload.update({
      collection: 'teams',
      id: teamId,
      data: {
        discordCardMessageId: messageId,
      },
    })
  } catch (error) {
    console.error('Error saving team message ID:', error)
  }
}
