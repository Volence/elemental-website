import { getDiscordClient } from '../bot'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { EmbedBuilder, TextChannel } from 'discord.js'

interface RescheduleInfo {
  matchId: number
  matchTitle: string
  oldDate: string
  newDate: string
  affectedStaffIds: number[]
}

/**
 * Send a Discord notification when a match is rescheduled.
 * Fetches the configured channel from the Production Dashboard global.
 */
export async function notifyMatchRescheduled(info: RescheduleInfo): Promise<void> {
  try {
    const client = getDiscordClient()
    if (!client) {
      console.warn('[matchRescheduleNotifier] Discord client not available')
      return
    }

    // Fetch the configured channel ID from the Production Dashboard global
    const payload = await getPayload({ config: configPromise })
    const dashboardConfig = await payload.findGlobal({
      slug: 'production-dashboard',
      depth: 0,
    })

    const channelId = (dashboardConfig as any)?.productionNotificationsChannelId
    if (!channelId) {
      console.warn('[matchRescheduleNotifier] No production notifications channel configured')
      return
    }

    // Fetch affected staff names
    let staffNames: string[] = []
    if (info.affectedStaffIds.length > 0) {
      const staffUsers = await Promise.all(
        info.affectedStaffIds.map(async (id) => {
          try {
            const user = await payload.findByID({ collection: 'users', id, depth: 0 })
            return user?.name || user?.email || `User #${id}`
          } catch {
            return `User #${id}`
          }
        })
      )
      staffNames = staffUsers
    }

    // Format dates
    const oldDateFormatted = new Date(info.oldDate).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/New_York',
      timeZoneName: 'short',
    })

    const newDateFormatted = new Date(info.newDate).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/New_York',
      timeZoneName: 'short',
    })

    // Build embed
    const embed = new EmbedBuilder()
      .setTitle('⚠️ Match Rescheduled')
      .setDescription(`**${info.matchTitle}** has been moved to a new time.`)
      .addFields(
        { name: '📅 Previous Time', value: oldDateFormatted, inline: true },
        { name: '📅 New Time', value: newDateFormatted, inline: true },
      )
      .setColor(0xFFA500) // Orange for warning
      .setTimestamp()

    if (staffNames.length > 0) {
      embed.addFields({
        name: '👥 Affected Staff (signups cleared)',
        value: staffNames.join(', '),
        inline: false,
      })
    }

    embed.addFields({
      name: '📋 Action Required',
      value: 'All production staff signups and assignments have been cleared. Please re-sign up if available for the new time.',
      inline: false,
    })

    // Send to channel
    const channel = await client.channels.fetch(channelId) as TextChannel | null
    if (!channel || !('send' in channel)) {
      console.warn(`[matchRescheduleNotifier] Channel ${channelId} not found or not a text channel`)
      return
    }

    await channel.send({ embeds: [embed] })
    console.log(`[matchRescheduleNotifier] Sent reschedule notification for match ${info.matchId}`)
  } catch (error) {
    console.error('[matchRescheduleNotifier] Error sending notification:', error)
  }
}
