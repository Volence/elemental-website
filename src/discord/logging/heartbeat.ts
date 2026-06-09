import { EmbedBuilder, type Client } from 'discord.js'
import type { Payload } from 'payload'
import { loadLoggingConfig } from './config'
import { resolveLogChannelId } from './channels'

let lastDisconnectAtMs: number | null = null

export function markDisconnected(nowMs: number): void {
  lastDisconnectAtMs = nowMs
}

/** Post "logging online" (with downtime if known) to every enabled server's server-log. */
export async function postHeartbeat(client: Client, payload: Payload, nowMs: number): Promise<void> {
  const downtime = lastDisconnectAtMs ? Math.round((nowMs - lastDisconnectAtMs) / 1000) : null
  lastDisconnectAtMs = null
  for (const guild of client.guilds.cache.values()) {
    const cfg = await loadLoggingConfig(payload, guild.id)
    if (!cfg) continue
    const channelId = resolveLogChannelId(cfg, 'server')
    if (!channelId) continue
    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle('Logging online')
      .setDescription(
        downtime !== null
          ? `Logging resumed after ${downtime}s offline. Events during that window were not captured.`
          : 'Logging started.',
      )
      .setTimestamp(new Date())
    const channel = await client.channels.fetch(channelId).catch(() => null)
    if (channel && channel.isTextBased() && 'send' in channel) {
      await (channel as any).send({ embeds: [embed] }).catch(() => {})
    }
  }
}
