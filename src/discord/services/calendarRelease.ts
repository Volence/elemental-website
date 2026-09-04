import { getPayload, type Payload, type PayloadRequest } from 'payload'
import configPromise from '@payload-config'
import { EmbedBuilder, type TextChannel, type ThreadChannel } from 'discord.js'
import { ensureDiscordClient, getDiscordClient } from '../bot'
import { serviceHealth } from '../serviceHealth'
import { nowInTimezone } from '@/utilities/socialMediaDigest'
import { dateFromKey, maintainTeamCalendars, shouldAnnounceCalendar, shouldReleaseNextWeek, toDateKey } from '@/utilities/weeklyCalendars'

/**
 * Weekly availability release.
 *
 * Every few minutes, for every active team: make sure this week's calendar
 * exists and, once the team's release day and time have passed in the team's
 * timezone, next week's too. Creating a calendar fires the DiscordPolls
 * afterChange hook, which calls `announceCalendar` to drop the availability
 * link in the team's availability thread. Managers no longer have to run
 * /schedulepoll by hand every Saturday.
 */

const CHECK_INTERVAL_MS = 5 * 60 * 1000
export const CALENDAR_RELEASE_SERVICE = 'calendar-release'
const DEFAULT_TZ = 'America/New_York'

let timer: NodeJS.Timeout | null = null
let running = false

export function startCalendarRelease(): void {
  if (timer) return
  console.log('[CalendarRelease] Starting service')
  timer = setInterval(() => {
    if (running) return
    running = true
    runCalendarReleaseCheck()
      .catch((err) => console.error('[CalendarRelease] check failed:', err))
      .finally(() => { running = false })
  }, CHECK_INTERVAL_MS)
}

export function stopCalendarRelease(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

export async function runCalendarReleaseCheck(): Promise<{ teams: number; created: number }> {
  if (!getDiscordClient()) return { teams: 0, created: 0 } // bot not up yet; try again next tick
  const started = Date.now()
  const payload = await getPayload({ config: configPromise })
  let created = 0
  let teamCount = 0
  try {
    const teams = await payload.find({
      collection: 'teams',
      where: { active: { equals: true } },
      limit: 200,
      depth: 0,
      overrideAccess: true,
    })
    for (const team of teams.docs as any[]) {
      teamCount++
      const local = nowInTimezone(team.scheduleTimezone || DEFAULT_TZ)
      const releaseNextWeek = shouldReleaseNextWeek({
        localDate: local.dateKey,
        localTime: local.hhmm,
        releaseDay: team.nextWeekReleaseDay,
      })
      try {
        const result = await maintainTeamCalendars(payload, team, {
          now: dateFromKey(local.dateKey),
          releaseNextWeek,
          canWrite: true,
        })
        created += result.created.length
      } catch (err) {
        console.error(`[CalendarRelease] team ${team.id} (${team.name}) failed:`, (err as Error).message)
      }
    }
    serviceHealth.record(CALENDAR_RELEASE_SERVICE, true, `${teamCount} teams, ${created} created`, Date.now() - started)
  } catch (err) {
    serviceHealth.record(CALENDAR_RELEASE_SERVICE, false, (err as Error).message, Date.now() - started)
    throw err
  }
  return { teams: teamCount, created }
}

export function teamSlugFor(team: any): string {
  return (
    team.slug ||
    String(team.name || '')
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
  )
}

export function availabilityUrlFor(team: any): string {
  const siteUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'https://elmt.gg'
  return `${siteUrl}/schedule/${teamSlugFor(team)}?tab=availability`
}

function weekLabel(calendar: any): string | null {
  const start = calendar?.dateRange?.start
  const end = calendar?.dateRange?.end
  if (!start || !end) return null
  const fmt = (key: string) => dateFromKey(key).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${fmt(start)} - ${fmt(end)}`
}

/** The embed both /schedulepoll and the automatic release post. */
export function buildAvailabilityEmbed(team: any, calendar?: any): EmbedBuilder {
  const week = calendar ? weekLabel(calendar) : null
  const lines = [
    week
      ? `Availability for the week of **${week}** is open. Fill it in so the schedule can be built.`
      : 'Submit your availability for this week so we can build the schedule.',
    '',
    `[Fill Out Availability](${availabilityUrlFor(team)})`,
  ]
  return new EmbedBuilder()
    .setTitle(`Weekly Availability - ${team.name}`)
    .setDescription(lines.join('\n'))
    .setColor(0x5865f2)
}

/**
 * Post the availability link for a newly created calendar to the team's
 * availability thread and remember the message on the calendar.
 *
 * `req` is passed when called from the create hook so the message-id save
 * joins the same transaction; without it the row is not visible yet.
 */
export async function announceCalendar(payload: Payload, calendar: any, team: any, req?: PayloadRequest): Promise<string | null> {
  const threadId = team?.discordThreads?.availabilityThreadId
  if (!threadId) return null
  const client = await ensureDiscordClient()
  if (!client) {
    console.warn('[CalendarRelease] Discord client not available; availability link not posted')
    return null
  }
  const channel = await client.channels.fetch(threadId).catch(() => null)
  if (!channel || !('send' in channel)) {
    console.warn(`[CalendarRelease] availability thread ${threadId} for ${team.name} not found`)
    return null
  }
  const sent = await (channel as TextChannel | ThreadChannel).send({ embeds: [buildAvailabilityEmbed(team, calendar)] })
  try {
    await payload.update({
      collection: 'discord-polls' as any,
      id: calendar.id,
      data: { discordChannelId: threadId, discordMessageId: sent.id } as any,
      overrideAccess: true,
      req,
    })
  } catch (err) {
    console.error(`[CalendarRelease] posted for ${team.name} but could not save message id:`, (err as Error).message)
  }
  console.log(`[CalendarRelease] posted availability link for ${team.name} (week of ${toDateKey(calendar.dateRange?.start ?? '')})`)
  return sent.id
}

/** Called from the DiscordPolls afterChange hook on create. */
export async function announceCalendarIfDue(payload: Payload, calendar: any, req?: PayloadRequest): Promise<void> {
  const teamId = typeof calendar.team === 'object' ? calendar.team?.id : calendar.team
  if (!teamId) return
  const team = await payload.findByID({ collection: 'teams', id: teamId, depth: 0, overrideAccess: true, req }).catch(() => null)
  if (!team) return
  const local = nowInTimezone((team as any).scheduleTimezone || DEFAULT_TZ)
  if (!shouldAnnounceCalendar(calendar, team as any, local.dateKey)) return
  try {
    await announceCalendar(payload, calendar, team, req)
  } catch (err) {
    console.error(`[CalendarRelease] announce failed for ${(team as any).name}:`, (err as Error).message)
  }
}
