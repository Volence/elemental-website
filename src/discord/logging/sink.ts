import type { Client, EmbedBuilder } from 'discord.js'
import type { Payload } from 'payload'
import { loadLoggingConfig } from './config'
import { resolveLogChannelId, type LogCategory, type LoggingConfig } from './channels'
import { logError } from '@/utilities/errorLogger'

export interface PostLogOptions {
  /** Pre-loaded config to skip the lookup (hot paths that already loaded it). */
  cfg?: LoggingConfig | null
  /**
   * Plain text above the embed - used for the subject's `<@id>` mention. Mentions in
   * message CONTENT always render (and click through to the in-server profile popout
   * with roles); mentions inside embeds only render when the viewer's client happens
   * to have the user cached, so they often show as raw `<@123>` text. Never pings:
   * allowedMentions is suppressed on every log post.
   */
  content?: string
}

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
  opts: PostLogOptions = {},
): Promise<void> {
  try {
    const cfg = opts.cfg ?? (await loadLoggingConfig(payload, guildId))
    if (!cfg) return
    const channelId = resolveLogChannelId(cfg, category)
    if (!channelId) return
    const channel = await client.channels.fetch(channelId).catch(() => null)
    if (channel && channel.isTextBased() && 'send' in channel) {
      // Stamp every log with the event time (Discord renders this localized per viewer).
      embed.setTimestamp(new Date())
      await (channel as any).send({
        ...(opts.content ? { content: opts.content } : {}),
        embeds: [embed],
        allowedMentions: { parse: [] },
      })
    } else {
      // Surface misconfiguration instead of silently dropping the log (e.g. a forum/voice
      // channel was picked as a log target, or the channel was deleted).
      await logError(payload, {
        errorType: 'system',
        message: `Discord logging: channel ${channelId} (${guildId}/${category}) is missing or not a sendable text channel - pick a text channel in the Logging tab`,
        severity: 'low',
      }).catch(() => {})
    }
  } catch (error: any) {
    await logError(payload, {
      errorType: 'system',
      message: `Discord logging postLog failed (${guildId}/${category}): ${error?.message}`,
      severity: 'medium',
    }).catch(() => {})
  }
}
