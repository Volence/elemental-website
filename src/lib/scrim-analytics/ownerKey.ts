/**
 * Scrim rows are still owned by an email string (`scrim_scrims.creatorEmail`). Discord-only
 * people have no email, so they get a stable synthetic key derived from their Discord ID.
 * Uploading and reading must agree on this, so both sides call this helper.
 *
 * Step 2 of the identity work replaces the column with a person id and this helper goes away.
 */
export function scrimOwnerKey(user: { email?: string | null; discordId?: string | null }): string | null {
  const email = user.email?.trim()
  if (email) return email
  const discordId = user.discordId?.trim()
  if (discordId) return `discord_${discordId}@elmt.placeholder`
  return null
}
