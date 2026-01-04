import type { EmbedBuilder, TextChannel } from 'discord.js'
import { getDiscordClient } from '../bot'
import { buildEnhancedTeamEmbed, buildStaffEmbed } from '../utils/embeds'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
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
    const payload = await getPayload({ config: configPromise })
    const team = await payload.findByID({
      collection: 'teams',
      id: teamId,
      depth: 2,
    })
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
    const embed = await buildEnhancedTeamEmbed(team, payload)

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

    // Get payload instance
    const payload = await getPayload({ config: configPromise })

    // Step 1: Delete all existing team card messages (keep staff cards)
    await deleteAllTeamCardMessages(channel, payload)

    // Step 2: Post staff cards
    await postStaffCards(channel, payload)

    // Step 3: Fetch and sort all teams
    const teams = await fetchAllTeamsSorted(payload)

    // Step 4: Post team cards in order
    for (const team of teams) {
      const embed = await buildEnhancedTeamEmbed(team, payload)
      const message = await channel.send({ embeds: [embed] })
      await saveTeamMessageId(team.id, message.id, payload)
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
async function deleteAllTeamCardMessages(channel: TextChannel, payload: any): Promise<void> {
  try {
    // Fetch all teams with message IDs
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
async function postStaffCards(channel: TextChannel, payload: any): Promise<void> {
  try {
    // Get all organization staff with populated person relationships
    const orgStaff = await payload.find({
      collection: 'organization-staff',
      limit: 200,
      depth: 1,
    })

    if (orgStaff.docs.length === 0) return

    // Group staff by role (similar to the staff page)
    const roleGroups = {
      owner: [] as any[],
      'co-owner': [] as any[],
      hr: [] as any[],
      graphics: [] as any[],
      'social-manager': [] as any[],
      moderator: [] as any[],
      'event-manager': [] as any[],
      'media-editor': [] as any[],
    }

    // Group staff members by their roles
    for (const staff of orgStaff.docs) {
      if (staff.roles && Array.isArray(staff.roles)) {
        for (const role of staff.roles) {
          if (role in roleGroups) {
            roleGroups[role as keyof typeof roleGroups].push(staff)
          }
        }
      }
    }

    // Role labels matching the staff page
    const roleLabels: Record<string, string> = {
      owner: 'Owner',
      'co-owner': 'Co-Owner',
      hr: 'HR Staff',
      graphics: 'Graphics Staff',
      'social-manager': 'Social Manager',
      moderator: 'Moderator',
      'event-manager': 'Event Manager',
      'media-editor': 'Media Editor',
    }

    // Post each role group as a separate card (only if non-empty)
    for (const [role, staffMembers] of Object.entries(roleGroups)) {
      if (staffMembers.length > 0) {
        const embed = buildStaffEmbed(roleLabels[role] || role, staffMembers)
        await channel.send({ embeds: [embed] })
        console.log(`✅ Posted ${roleLabels[role]} card (${staffMembers.length} members)`)
        
        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 300))
      }
    }
  } catch (error) {
    console.error('Error posting staff cards:', error)
  }
}

/**
 * Fetch all teams sorted by region and SR (descending)
 */
async function fetchAllTeamsSorted(payload: any): Promise<any[]> {
  try {
    const result = await payload.find({
      collection: 'teams',
      limit: 1000,
      sort: 'region', // Sort by region first
      depth: 2,
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
        const aRating = parseRating(a.rating) || 0
        const bRating = parseRating(b.rating) || 0
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
 * Parse rating string (e.g., "4.2K" -> 4200) for sorting
 */
function parseRating(rating: string | undefined): number {
  if (!rating) return 0
  const match = rating.match(/([0-9.]+)([KkMm]?)/)
  if (!match) return 0
  
  const num = parseFloat(match[1])
  const multiplier = match[2]?.toUpperCase()
  
  if (multiplier === 'K') return num * 1000
  if (multiplier === 'M') return num * 1000000
  return num
}

/**
 * Save Discord message ID to team document
 */
async function saveTeamMessageId(teamId: string | number, messageId: string, payload: any): Promise<void> {
  try {
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
