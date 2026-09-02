import { getPayload, type Payload } from 'payload'
import configPromise from '@payload-config'
import type { TextChannel, ThreadChannel } from 'discord.js'
import { ensureDiscordClient, getDiscordClient } from '../bot'
import { serviceHealth } from '../serviceHealth'
import { buildDailyPing, nowInTimezone, shouldSendDailyPing } from '@/utilities/socialMediaDigest'
import { fetchDigestTasks, parseDayKey } from './socialDigest'

/**
 * Morning-of reminder: "Posts due today" to a channel of the team's choosing.
 * Runs in-process like the other Discord services (checked once a minute),
 * fires once per day after the configured local time, and stays quiet on days
 * with nothing due.
 */

const SETTINGS_SLUG = 'social-media-settings' as const
const CHECK_INTERVAL_MS = 60 * 1000
export const DAILY_PING_SERVICE = 'social-daily-ping'

let timer: NodeJS.Timeout | null = null
let running = false

export function startSocialDailyPing(): void {
  if (timer) return
  console.log('[SocialDailyPing] Starting service')
  timer = setInterval(() => {
    if (running) return
    running = true
    runDailyPingCheck()
      .catch((err) => console.error('[SocialDailyPing] check failed:', err))
      .finally(() => { running = false })
  }, CHECK_INTERVAL_MS)
}

export function stopSocialDailyPing(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

/** Scheduled check: send if it is time and today has not run yet. */
export async function runDailyPingCheck(): Promise<void> {
  if (!getDiscordClient()) return // bot not up yet; try again next minute
  const payload = await getPayload({ config: configPromise })
  const settings = (await payload.findGlobal({ slug: SETTINGS_SLUG, depth: 0 })) as any
  const nowLocal = nowInTimezone(settings?.dailyPingTimezone || 'America/New_York')
  const due = shouldSendDailyPing({
    enabled: settings?.dailyPingEnabled === true,
    channelId: settings?.dailyPingChannelId,
    time: settings?.dailyPingTime || '09:00',
    lastSentDate: settings?.dailyPingLastSent,
    nowLocal,
  })
  if (!due) return
  const start = Date.now()
  try {
    await sendDailyPing(payload, nowLocal.dateKey, settings.dailyPingChannelId)
    serviceHealth.record(DAILY_PING_SERVICE, true, 'sent', Date.now() - start)
  } catch (err) {
    serviceHealth.record(DAILY_PING_SERVICE, false, (err as Error).message, Date.now() - start)
    throw err
  }
}

/**
 * Build and send today's ping to `channelId`, then mark the day as done.
 * Returns the text that was sent, or null when nothing was due.
 */
export async function sendDailyPing(payload: Payload, dateKey: string, channelId: string): Promise<string | null> {
  const day = parseDayKey(dateKey)
  const tasks = await fetchDigestTasks(payload, day, day)
  const text = buildDailyPing({ dateKey, tasks })

  if (text) {
    const client = await ensureDiscordClient()
    if (!client) throw new Error('Discord bot is not connected')
    const channel = (await client.channels.fetch(channelId).catch(() => null)) as TextChannel | ThreadChannel | null
    if (!channel || !('send' in channel)) throw new Error('Could not find the daily ping channel')
    await channel.send({ content: text, allowedMentions: { parse: ['users'] } })
  }

  await payload.updateGlobal({ slug: SETTINGS_SLUG, data: { dailyPingLastSent: dateKey }, overrideAccess: true })
  return text
}
