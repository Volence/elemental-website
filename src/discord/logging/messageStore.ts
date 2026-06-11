import type { Message } from 'discord.js'
import type { Payload } from 'payload'
import { attachmentMetadata, type AttachmentMeta } from './attachments'
import { logError } from '@/utilities/errorLogger'

/**
 * DB-backed message buffer so delete/edit logs can resolve author + content even when
 * the message predates the bot's in-memory cache (which wipes on every deploy) and the
 * audit log has nothing (self-deletes write no audit entry). Rows are pruned after
 * RETENTION_DAYS and removed once consumed - a working buffer, not an archive.
 */

export const RETENTION_DAYS = 30
/** Discord's max message length (with Nitro) - matches what a delete log could ever show. */
const MAX_STORED_CONTENT = 4000

export interface StoredMessage {
  authorId: string
  authorTag: string
  content: string | null
  attachments: AttachmentMeta[]
}

export function isPrunable(sentAtMs: number, nowMs: number, retentionDays: number = RETENTION_DAYS): boolean {
  return nowMs - sentAtMs > retentionDays * 86400000
}

/** Record a new message. Failures are logged, never thrown - logging must not break the bot. */
export async function storeMessage(payload: Payload, msg: Message): Promise<void> {
  try {
    await payload.create({
      collection: 'discord-logged-messages' as any,
      data: {
        messageId: msg.id,
        guildId: msg.guild!.id,
        channelId: msg.channelId,
        authorId: msg.author.id,
        authorTag: msg.author.tag,
        content: (msg.content || '').slice(0, MAX_STORED_CONTENT) || null,
        attachments: msg.attachments?.size ? attachmentMetadata([...msg.attachments.values()] as any) : null,
        sentAt: new Date(msg.createdTimestamp).toISOString(),
      },
    })
  } catch (error: any) {
    await logError(payload, {
      errorType: 'system',
      message: `Discord logging storeMessage failed (${msg.guild?.id}/${msg.id}): ${error?.message}`,
      severity: 'low',
    }).catch(() => {})
  }
}

/** Update stored content after an edit so a later delete shows the latest text. */
export async function updateStoredMessage(payload: Payload, messageId: string, content: string): Promise<void> {
  try {
    const { docs } = await payload.find({
      collection: 'discord-logged-messages' as any,
      where: { messageId: { equals: messageId } },
      limit: 1,
      depth: 0,
    })
    const row: any = docs[0]
    if (!row) return
    await payload.update({
      collection: 'discord-logged-messages' as any,
      id: row.id,
      data: { content: content.slice(0, MAX_STORED_CONTENT) || null },
    })
  } catch {
    // Best-effort: a missed edit update only means a later delete shows slightly older text.
  }
}

export async function getStoredMessage(payload: Payload, messageId: string): Promise<StoredMessage | null> {
  try {
    const { docs } = await payload.find({
      collection: 'discord-logged-messages' as any,
      where: { messageId: { equals: messageId } },
      limit: 1,
      depth: 0,
    })
    const row: any = docs[0]
    if (!row) return null
    return {
      authorId: row.authorId,
      authorTag: row.authorTag,
      content: row.content ?? null,
      attachments: Array.isArray(row.attachments) ? row.attachments : [],
    }
  } catch {
    return null
  }
}

/** Remove a consumed row (its message was deleted and the delete has been logged). */
export async function deleteStoredMessage(payload: Payload, messageId: string): Promise<void> {
  try {
    await payload.delete({
      collection: 'discord-logged-messages' as any,
      where: { messageId: { equals: messageId } },
    })
  } catch {
    // Leftover rows are swept by the retention prune.
  }
}

/** Retention sweep - called periodically from setupLogging. */
export async function pruneStoredMessages(payload: Payload, nowMs: number): Promise<void> {
  try {
    await payload.delete({
      collection: 'discord-logged-messages' as any,
      where: { sentAt: { less_than: new Date(nowMs - RETENTION_DAYS * 86400000).toISOString() } },
    })
  } catch (error: any) {
    await logError(payload, {
      errorType: 'system',
      message: `Discord logging pruneStoredMessages failed: ${error?.message}`,
      severity: 'low',
    }).catch(() => {})
  }
}
