import type { Client, EmbedBuilder } from 'discord.js'
import type { Payload } from 'payload'
import { loadLoggingConfig } from './config'
import { resolveLogChannelId, type LogCategory, type LoggingConfig } from './channels'
import { logError } from '@/utilities/errorLogger'

/**
 * Post an embed to the configured channel for (guild, category). No-op when logging is
 * disabled or the category channel is unset. Never throws - failures go to the error logger.
 */
export async function postLog(
  client: Client,
  payload: Payload,
  guildId: string,
  category: LogCategory,
  embed: EmbedBuilder,
  cfgOverride?: LoggingConfig | null,
): Promise<void> {
  try {
    const cfg = cfgOverride ?? (await loadLoggingConfig(payload, guildId))
    if (!cfg) return
    const channelId = resolveLogChannelId(cfg, category)
    if (!channelId) return
    const channel = await client.channels.fetch(channelId).catch(() => null)
    if (channel && channel.isTextBased() && 'send' in channel) {
      await (channel as any).send({ embeds: [embed] })
    }
  } catch (error: any) {
    await logError(payload, {
      errorType: 'system',
      message: `Discord logging postLog failed (${guildId}/${category}): ${error?.message}`,
      severity: 'medium',
    }).catch(() => {})
  }
}
