import { EmbedBuilder, type Client } from 'discord.js'
import type { Payload } from 'payload'
import { loadLoggingConfig } from './config'
import { resolveLogChannelId } from './channels'
import { Colors } from './colors'

let lastDisconnectAtMs: number | null = null

/** Gaps shorter than this are not worth a channel post. */
export const MIN_ANNOUNCE_GAP_SECONDS = 60

/** Record when the gateway dropped. Keeps the EARLIEST timestamp until cleared, so
 * repeated reconnect attempts don't shrink the measured gap. */
export function markDisconnected(nowMs: number): void {
  if (lastDisconnectAtMs === null) lastDisconnectAtMs = nowMs
}

/** A successful gateway RESUME replays missed events - no coverage gap, nothing to announce. */
export function clearDisconnected(): void {
  lastDisconnectAtMs = null
}

/**
 * Seconds of logging downtime worth announcing, or null when there's nothing to say.
 * Null when no disconnect was recorded (fresh boot/deploy - stay silent instead of
 * spamming "Logging started." on every restart) or when the gap was trivially short.
 */
export function announceableDowntimeSeconds(
  disconnectAtMs: number | null,
  nowMs: number,
  minSeconds: number = MIN_ANNOUNCE_GAP_SECONDS,
): number | null {
  if (disconnectAtMs === null) return null
  const seconds = Math.round((nowMs - disconnectAtMs) / 1000)
  return seconds >= minSeconds ? seconds : null
}

/**
 * Announce a real logging gap (re-identify after a disconnect) to every enabled server's
 * server-log. Silent on clean boots, deploys, and sub-minute blips.
 */
export async function postHeartbeat(client: Client, payload: Payload, nowMs: number): Promise<void> {
  const downtime = announceableDowntimeSeconds(lastDisconnectAtMs, nowMs)
  lastDisconnectAtMs = null
  if (downtime === null) return
  for (const guild of client.guilds.cache.values()) {
    const cfg = await loadLoggingConfig(payload, guild.id)
    if (!cfg) continue
    const channelId = resolveLogChannelId(cfg, 'server')
    if (!channelId) continue
    const embed = new EmbedBuilder()
      .setColor(Colors.create)
      .setTitle('Logging gap')
      .setDescription(`Logging resumed after ${downtime}s offline. Events during that window were not captured.`)
      .setTimestamp(new Date())
    const channel = await client.channels.fetch(channelId).catch(() => null)
    if (channel && channel.isTextBased() && 'send' in channel) {
      await (channel as any).send({ embeds: [embed] }).catch(() => {})
    }
  }
}
