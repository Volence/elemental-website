'use server'

import { ensureDiscordClient } from '../bot'
import { getPayload } from 'payload'
import config from '@payload-config'
import { EmbedBuilder, type TextChannel, type ThreadChannel } from 'discord.js'

interface RosterEntry {
  role: 'tank' | 'dps' | 'fdps' | 'hitscan' | 'support' | 'ms' | 'fs'
  isRinger?: boolean
  rosterPlayer?: {
    id: number
    name: string
  } | number
  rosterPlayerName?: string
  ringerPlayer?: {
    id: number
    name: string
  } | number
  ringerName?: string
}

interface QuickScrimData {
  id: number
  team: {
    id: number
    name: string
    discordThreads?: {
      scheduleThreadId?: string
    }
  }
  scrimDate: string
  scrimTime: string
  roster: RosterEntry[]
  opponent: string
  opponentRoster?: string
  host?: 'us' | 'them'
  contact?: string
  mapPool?: string
  heroBans?: boolean
  staggers?: boolean
  notes?: string
}

// Role display labels
const roleLabels: Record<string, string> = {
  tank: 'Tank',
  dps: 'DPS',
  fdps: 'Flex DPS',
  hitscan: 'Hitscan',
  support: 'Support',
  ms: 'Main Support',
  fs: 'Flex Support',
}

/**
 * Create a Discord embed for a quick scrim announcement
 */
function createQuickScrimEmbed(scrim: QuickScrimData): EmbedBuilder {
  const date = new Date(scrim.scrimDate)
  const dateStr = date.toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric' 
  })
  
  const embed = new EmbedBuilder()
    .setColor(0xf59e0b) // Amber/orange color
    .setTitle(`Scrim Reminder • ${dateStr}`)
  
  // Build description
  let description = ''
  
  // Time and opponent
  description += `**${scrim.scrimTime}**`
  if (scrim.opponent) {
    description += ` vs **${scrim.opponent}**`
    if (scrim.host) {
      description += ` • ${scrim.host === 'us' ? 'We host' : 'They host'}`
    }
  }
  description += '\n'
  
  // Separator
  description += '───────────────────────\n'
  
  // Roster
  description += '**Roster**\n'
  for (const entry of scrim.roster) {
    const roleLabel = roleLabels[entry.role] || entry.role
    let playerName: string
    
    if (entry.isRinger) {
      // Ringer mode - check ringerPlayer first, then ringerName
      if (entry.ringerPlayer && typeof entry.ringerPlayer === 'object') {
        playerName = `${entry.ringerPlayer.name} (ringer)`
      } else if (entry.ringerName) {
        playerName = `${entry.ringerName} (ringer)`
      } else {
        playerName = 'TBD (ringer)'
      }
    } else if (entry.rosterPlayer && typeof entry.rosterPlayer === 'object') {
      // Roster player - use populated name
      playerName = entry.rosterPlayer.name
    } else if (entry.rosterPlayerName) {
      // Manually typed roster player name
      playerName = entry.rosterPlayerName
    } else {
      // Fallback
      playerName = 'TBD'
    }
    
    description += `${roleLabel}: ${playerName}\n`
  }
  
  // Separator before match details
  description += '───────────────────────\n'
  
  // Match details
  const details: string[] = []
  if (scrim.contact) details.push(`Contact: ${scrim.contact}`)
  if (scrim.mapPool) details.push(`Maps: ${scrim.mapPool}`)
  details.push(`Hero Bans: ${scrim.heroBans ? 'On' : 'Off'}`)
  details.push(`Staggers: ${scrim.staggers ? 'On' : 'Off'}`)
  
  description += details.join('\n') + '\n'
  
  // Their roster (opponent roster)
  if (scrim.opponentRoster) {
    description += '\n**Their Roster**\n'
    description += scrim.opponentRoster + '\n'
  }
  
  embed.setDescription(description)
  
  // Notes in footer
  if (scrim.notes) {
    embed.setFooter({ text: scrim.notes })
  }
  
  return embed
}

/**
 * Post a quick scrim to the Schedule thread
 */
export async function postQuickScrim(
  scrimId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = await ensureDiscordClient()
    if (!client) {
      return { success: false, error: 'Discord bot not connected' }
    }

    const payload = await getPayload({ config })

    // Fetch the scrim with team data
    const scrim = await payload.findByID({
      collection: 'quick-scrims',
      id: scrimId,
      depth: 1,
    }) as unknown as QuickScrimData

    if (!scrim) {
      return { success: false, error: 'Scrim not found' }
    }

    if (!scrim.team || typeof scrim.team !== 'object') {
      return { success: false, error: 'Team not found' }
    }

    // Get Schedule thread ID
    const scheduleThreadId = scrim.team.discordThreads?.scheduleThreadId
    if (!scheduleThreadId) {
      return { success: false, error: 'Schedule thread not configured for this team' }
    }

    // Create the embed
    const embed = createQuickScrimEmbed(scrim)

    // Fetch the Schedule thread
    const thread = await client.channels.fetch(scheduleThreadId) as TextChannel | ThreadChannel | null
    if (!thread || !('send' in thread)) {
      return { success: false, error: 'Could not find Schedule thread' }
    }

    // Post the scrim
    await thread.send({ embeds: [embed] })
    console.log(`✅ Posted quick scrim for "${scrim.opponent}" to ${scrim.team.name}`)

    // Update the posted flag (skip access checks to avoid validation issues)
    await payload.update({
      collection: 'quick-scrims',
      id: scrimId,
      data: {
        posted: true,
      },
      overrideAccess: true,
      context: {
        skipValidation: true,
      },
    })

    return { success: true }
  } catch (error) {
    console.error('Error posting quick scrim:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}
