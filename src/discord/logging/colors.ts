/**
 * Embed colors by semantic, defined once so every handler stays consistent. Hard-coding hex
 * in each handler is how the palette drifted (two greens, several reds), so route all embeds
 * through these.
 */
export const Colors = {
  create: 0x2ecc71, // channel/role created, member joined, unban, heartbeat online
  delete: 0xe74c3c, // channel/role deleted, message deleted
  update: 0xf1c40f, // channel/role updated, message edited
  memberUpdate: 0x3498db, // member roles/nickname changed (info-blue, distinct from create)
  punitive: 0xe67e22, // kick, timeout
  ban: 0xc0392b, // ban (most severe - kept distinct from kick/timeout)
  neutral: 0x95a5a6, // member left (voluntary)
  profile: 0x9b59b6, // avatar / username change
} as const
