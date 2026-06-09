export interface AttachmentMeta {
  name: string
  contentType: string | null
  size: number
  width: number | null
  height: number | null
  originalUrl: string
}

interface RawAttachment {
  name?: string | null
  contentType?: string | null
  size?: number | null
  width?: number | null
  height?: number | null
  url?: string | null
  proxyURL?: string | null
}

/**
 * Extract metadata ONLY. We never download or re-host the file (see spec:
 * re-hosting deleted attachments risks hosting illegal content).
 */
export function attachmentMetadata(attachments: RawAttachment[]): AttachmentMeta[] {
  return attachments.map((a) => ({
    name: a.name ?? 'unknown',
    contentType: a.contentType ?? null,
    size: a.size ?? 0,
    width: a.width ?? null,
    height: a.height ?? null,
    originalUrl: a.url ?? a.proxyURL ?? '',
  }))
}
