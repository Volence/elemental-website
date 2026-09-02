/**
 * Validates a returnUrl/state path before it's ever handed to NextResponse.redirect.
 *
 * Rejects anything that isn't a same-origin path: protocol-relative URLs ('//evil.com'),
 * backslash tricks ('/\evil.com', which some URL parsers treat as '//evil.com'), absolute
 * URLs to another origin, and anything that fails to parse.
 */
export function safeReturnPath(raw: string | null | undefined, serverUrl: string, fallback = '/admin'): string {
  if (typeof raw !== 'string' || raw.length === 0) return fallback
  if (!raw.startsWith('/')) return fallback
  if (raw.includes('\\')) return fallback
  if (raw.startsWith('//')) return fallback
  try {
    const resolved = new URL(raw, serverUrl)
    const base = new URL(serverUrl)
    if (resolved.origin !== base.origin) return fallback
    return raw
  } catch {
    return fallback
  }
}
