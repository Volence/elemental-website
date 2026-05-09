import type { ChatInputCommandInteraction } from 'discord.js'
import { EmbedBuilder, MessageFlags } from 'discord.js'

/**
 * /availability command
 * Posts the link to the team's schedule page so players can fill in availability.
 * Calendars are auto-created on Fridays, so this just finds the active one.
 */
export async function handleAvailability(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  await interaction.deferReply()

  try {
    const { getPayload } = await import('payload')
    const configPromise = await import('@/payload.config')
    const payload = await getPayload({ config: configPromise.default })

    const resolvedChannel =
      interaction.channel ??
      (await interaction.client.channels.fetch(interaction.channelId).catch(() => null))

    const threadId = resolvedChannel?.isThread() ? resolvedChannel.id : undefined

    let team: any = null
    if (threadId) {
      const teams = await payload.find({
        collection: 'teams',
        where: {
          and: [
            { 'discordThreads.availabilityThreadId': { equals: threadId } },
            { active: { equals: true } },
          ],
        },
        limit: 1,
        depth: 0,
      })
      if (teams.docs.length > 0) {
        team = teams.docs[0]
      }
    }

    if (!team) {
      await interaction.editReply({
        content:
          "Could not detect a team for this thread. Make sure this is posted in a team's availability thread.",
      })
      return
    }

    const siteUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'https://elmt.gg'
    const teamSlug = team.slug || team.name?.toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '')
    const calendarUrl = `${siteUrl}/schedule/${teamSlug}?tab=availability`

    const now = new Date()
    const dow = now.getDay()
    const mon = new Date(now)
    mon.setDate(now.getDate() - ((dow + 6) % 7))
    mon.setHours(0, 0, 0, 0)
    const sun = new Date(mon)
    sun.setDate(mon.getDate() + 6)
    const monStr = mon.toISOString().split('T')[0]
    const sunStr = sun.toISOString().split('T')[0]

    // Check for next week's calendar first (if it's Friday+)
    const nextMon = new Date(mon)
    nextMon.setDate(mon.getDate() + 7)
    const nextSun = new Date(nextMon)
    nextSun.setDate(nextMon.getDate() + 6)
    const nextMonStr = nextMon.toISOString().split('T')[0]
    const nextSunStr = nextSun.toISOString().split('T')[0]

    const nextWeekResult = await payload.find({
      collection: 'discord-polls' as any,
      where: {
        and: [
          { team: { equals: team.id } },
          { scheduleType: { equals: 'calendar' } },
          { status: { equals: 'active' } },
          { 'dateRange.start': { less_than_equal: nextSunStr } },
          { 'dateRange.end': { greater_than_equal: nextMonStr } },
        ],
      },
      limit: 1,
      sort: '-createdAt',
      depth: 0,
    })

    // Fall back to current week
    const currentWeekResult = await payload.find({
      collection: 'discord-polls' as any,
      where: {
        and: [
          { team: { equals: team.id } },
          { scheduleType: { equals: 'calendar' } },
          { status: { equals: 'active' } },
          { 'dateRange.start': { less_than_equal: sunStr } },
          { 'dateRange.end': { greater_than_equal: monStr } },
        ],
      },
      limit: 1,
      sort: '-createdAt',
      depth: 0,
    })

    const calendar = nextWeekResult.docs[0] || currentWeekResult.docs[0]

    if (!calendar) {
      await interaction.editReply({
        content: `No active availability calendar found for **${team.name}**. One will be created automatically on Friday, or a manager can create one from the website.\n\n${calendarUrl}`,
      })
      return
    }

    const cal = calendar as any
    const responseCount = cal.responses?.length || 0
    const startDate = new Date(cal.dateRange.start)
    const endDate = new Date(cal.dateRange.end)
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })

    const timezone = team.scheduleTimezone || 'America/New_York'
    const blocks = team.scheduleBlocks || []

    // Build Discord localized timestamps for the first day's blocks
    const refDate = new Date(startDate)
    const slotTimestamps = blocks.length > 0
      ? blocks.map((b: any) => {
          const [h, m] = (b.startTime || '18:00').split(':').map(Number)
          const dt = new Date(refDate)
          dt.setHours(h, m, 0, 0)
          // Convert from team timezone to UTC by creating a date string in the team's timezone
          const utcStr = dt.toLocaleString('en-US', { timeZone: timezone })
          const localDt = new Date(utcStr)
          const tzOffset = localDt.getTime() - dt.getTime()
          const unix = Math.floor((dt.getTime() - tzOffset) / 1000)
          return `<t:${unix}:t>`
        }).join(' / ')
      : '6-8 PM / 8-10 PM / 10-12 PM'

    const embed = new EmbedBuilder()
      .setTitle(`📅 ${cal.pollName || 'Availability'}`)
      .setDescription(
        `Fill in your availability for **${fmt(startDate)} - ${fmt(endDate)}**.\n\n` +
        `🕐 **Time Slots:** ${slotTimestamps}\n\n` +
        `👉 **[Click here to fill in your availability](${calendarUrl})**`
      )
      .setColor(0x00e5ff)
      .setFooter({ text: `ELMT ${team.name} - Responses: ${responseCount}` })
      .setTimestamp()

    await interaction.editReply({ embeds: [embed] })
  } catch (error) {
    console.error('[/availability] Error:', error)
    await interaction.editReply({
      content: 'Failed to fetch availability calendar. Check the logs.',
    })
  }
}
