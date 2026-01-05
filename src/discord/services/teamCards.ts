import type { EmbedBuilder, TextChannel } from 'discord.js'
import { ensureDiscordClient } from '../bot'
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
    const client = await ensureDiscordClient()
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
      } catch (error: any) {
        console.log(`Message ${existingMessageId} not found, will repost`)
      }
    }

    // Post new message
    const message = await channel.send({ embeds: [embed] })
    console.log(`✅ Posted new team card for ${team.name}`)

    // Save message ID to database
    await saveTeamMessageId(teamId, message.id, payload)

    return message.id
  } catch (error) {
    console.error('Error posting/updating team card:', error)
    return null
  }
}

/**
 * Refresh all team cards in order: Staff first, then teams by Division/SR
 */
export async function refreshAllTeamCards(): Promise<void> {
  try {
    const client = await ensureDiscordClient()
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

    // Step 1: Delete ALL messages from the channel
    await clearAllChannelMessages(channel)

    // Step 2: Post staff cards
    await postStaffCards(channel, payload)

    // Step 3: Fetch and sort all teams by Division > SR
    const teams = await fetchAllTeamsSorted(payload)

    // Step 4: Post team cards in order
    for (const team of teams) {
      const embed = await buildEnhancedTeamEmbed(team, payload)
      const message = await channel.send({ embeds: [embed] })
      
      // Save message ID so future edits update in-place (with skipDiscordUpdate to prevent loop)
      await saveTeamMessageId(team.id, message.id, payload)
      
      const division = (typeof team.currentFaceitLeague === 'object' && team.currentFaceitLeague?.division) 
        ? team.currentFaceitLeague.division 
        : 'Open'
      console.log(`✅ Posted card for ${team.name} (${team.region || 'NA'} - ${division} - ${team.rating || 'N/A'})`)

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500))
    }

    console.log(`✅ Refreshed ${teams.length} team cards + staff cards`)
  } catch (error) {
    console.error('Error refreshing all team cards:', error)
  }
}

/**
 * Clear all messages from the channel
 */
async function clearAllChannelMessages(channel: TextChannel): Promise<void> {
  try {
    console.log(`🗑️  Clearing all messages from channel ${channel.name} (${channel.id})...`)
    
    let deleted = 0
    let fetched = 0
    let iterations = 0
    const twoWeeksAgo = Date.now() - (14 * 24 * 60 * 60 * 1000)
    
    // Fetch and delete messages in batches
    while (iterations < 50) { // Safety limit
      iterations++
      const messages = await channel.messages.fetch({ limit: 100 })
      console.log(`   Batch ${iterations}: Fetched ${messages.size} messages`)
      
      if (messages.size === 0) break
      
      fetched += messages.size
      
      // Separate messages by age (Discord bulk delete only works for messages < 14 days)
      const recentMessages = messages.filter(m => m.createdTimestamp > twoWeeksAgo)
      const oldMessages = messages.filter(m => m.createdTimestamp <= twoWeeksAgo)
      
      // Bulk delete recent messages (faster)
      if (recentMessages.size > 0) {
        try {
          const bulkDeleted = await channel.bulkDelete(recentMessages, true)
          deleted += bulkDeleted.size
          console.log(`   Bulk deleted ${bulkDeleted.size} recent messages`)
        } catch (error: any) {
          console.log(`   Bulk delete failed: ${error.message}, falling back to individual delete`)
          // Fallback: delete individually
          for (const message of recentMessages.values()) {
            try {
              await message.delete()
              deleted++
              await new Promise((resolve) => setTimeout(resolve, 100))
            } catch (err: any) {
              console.log(`   Failed to delete message ${message.id}: ${err.message}`)
            }
          }
        }
      }
      
      // Delete old messages one by one
      if (oldMessages.size > 0) {
        console.log(`   Deleting ${oldMessages.size} old messages individually...`)
        for (const message of oldMessages.values()) {
          try {
            await message.delete()
            deleted++
          } catch (error: any) {
            console.log(`   Failed to delete old message ${message.id}: ${error.message}`)
          }
          // Delay to avoid rate limits (slower for old messages)
          await new Promise((resolve) => setTimeout(resolve, 150))
        }
      }
      
      if (messages.size < 100) break
    }
    
    console.log(`🗑️  Cleared ${deleted}/${fetched} messages from channel in ${iterations} batches`)
  } catch (error) {
    console.error('Error clearing channel messages:', error)
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

    // Get all production staff with populated person relationships
    const productionStaff = await payload.find({
      collection: 'production',
      limit: 200,
      depth: 1,
    })

    // Group production staff: Casters separate, all others as "Production"
    const casters: any[] = []
    const production: any[] = []
    
    for (const staff of productionStaff.docs) {
      const type = staff.type || 'Other'
      if (type.toLowerCase() === 'caster') {
        casters.push(staff)
      } else {
        // All others (Observer, Producer, Observer/Producer, etc.)
        production.push(staff)
      }
    }

    // Post Caster card
    if (casters.length > 0) {
      const embed = buildStaffEmbed('Caster', casters)
      await channel.send({ embeds: [embed] })
      console.log(`✅ Posted Caster card (${casters.length} members)`)
      await new Promise((resolve) => setTimeout(resolve, 300))
    }

    // Post Production card (all other production roles)
    if (production.length > 0) {
      const embed = buildStaffEmbed('Production', production)
      await channel.send({ embeds: [embed] })
      console.log(`✅ Posted Production card (${production.length} members)`)
      await new Promise((resolve) => setTimeout(resolve, 300))
    }
  } catch (error) {
    console.error('Error posting staff cards:', error)
  }
}

/**
 * Fetch all teams sorted by Division (Masters > Expert > Advanced > Open), then by SR within division
 */
async function fetchAllTeamsSorted(payload: any): Promise<any[]> {
  try {
    const result = await payload.find({
      collection: 'teams',
      limit: 1000,
      depth: 2,
    })

    // Define region order (NA > EMEA > SA)
    const regionOrder = {
      'NA': 1,
      'EMEA': 2,
      'SA': 3,
    }

    // Define division order (Masters > Expert > Advanced > Open)
    const divisionOrder = {
      'Masters': 1,
      'Expert': 2,
      'Advanced': 3,
      'Open': 4,
    }

    // Sort teams by: 1) Region, 2) Division, 3) SR
    const sorted = result.docs.sort((a: any, b: any) => {
      // First sort by region
      const aRegion = a.region || 'NA'
      const bRegion = b.region || 'NA'
      const aRegionOrder = regionOrder[aRegion as keyof typeof regionOrder] || 999
      const bRegionOrder = regionOrder[bRegion as keyof typeof regionOrder] || 999
      
      if (aRegionOrder !== bRegionOrder) {
        return aRegionOrder - bRegionOrder
      }
      
      // Then sort by division within same region
      // Division is in currentFaceitLeague.division (populated with depth: 2)
      const aDivision = (typeof a.currentFaceitLeague === 'object' && a.currentFaceitLeague?.division) 
        ? a.currentFaceitLeague.division 
        : 'Open'
      const bDivision = (typeof b.currentFaceitLeague === 'object' && b.currentFaceitLeague?.division)
        ? b.currentFaceitLeague.division
        : 'Open'
      
      const aDivOrder = divisionOrder[aDivision as keyof typeof divisionOrder] || 999
      const bDivOrder = divisionOrder[bDivision as keyof typeof divisionOrder] || 999
      
      if (aDivOrder !== bDivOrder) {
        return aDivOrder - bDivOrder
      }
      
      // Finally sort by SR within same division (high to low)
      const aRating = parseRating(a.rating) || 0
      const bRating = parseRating(b.rating) || 0
      return bRating - aRating
    })

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
      context: {
        skipDiscordUpdate: true, // Prevent afterChange hook from firing Discord update
      },
    })
  } catch (error) {
    console.error('Error saving team message ID:', error)
  }
}
