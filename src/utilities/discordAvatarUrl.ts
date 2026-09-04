/**
 * People.discordAvatar holds whatever Discord handed us at login: today the
 * bare avatar hash (e.g. "02df672c..."), historically a full CDN URL. Turn
 * either into something an <img> can load. Animated avatars ("a_" prefix)
 * still render as PNG on the CDN, which is what a 22px chip wants anyway.
 */
export function discordAvatarUrl(
  discordId: string | null | undefined,
  avatar: string | null | undefined,
  size: 32 | 64 | 128 = 64,
): string | null {
  const a = (avatar ?? '').trim()
  if (!a) return null
  if (/^https?:\/\//i.test(a)) return a
  if (!discordId || !/^[a-zA-Z0-9_]+$/.test(a)) return null
  return `https://cdn.discordapp.com/avatars/${discordId}/${a}.png?size=${size}`
}
