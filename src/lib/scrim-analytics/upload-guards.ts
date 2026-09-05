/**
 * Validation guards for the scrim-upload route.
 */

import type { ResolvedAccess } from '@/access'

/**
 * Parse a player_name → Person id mapping from its JSON form value.
 *
 * Returns {} when absent, null when the JSON is malformed or not an object -
 * callers must treat null as a 400, never as "no mappings": silently dropping
 * mappings produces a scrim with zero person linkage, which breaks side
 * resolution and every person-scoped stat while looking like a clean upload.
 */
export function parsePlayerMappings(str: string | null): Record<string, number> | null {
  if (!str) return {}
  let parsed: unknown
  try {
    parsed = JSON.parse(str)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return null
  }
  const mappings: Record<string, number> = {}
  for (const [name, id] of Object.entries(parsed)) {
    if (id != null && !isNaN(Number(id))) {
      mappings[name] = Number(id)
    }
  }
  return mappings
}

/**
 * Validate who may upload what: org-team scrims need staff or team access;
 * external-team scrims (free-text team, no org link) additionally need the
 * canUploadExternalScrims flag - which also lets non-manager coaches upload,
 * but ONLY external scrims. Returns an error message or null.
 */
export function validateUploadTarget(opts: {
  access: ResolvedAccess
  teamId: number | null
  externalTeamName: string | null
}): string | null {
  const { access } = opts
  const isManager = access.canManagePeople || access.teamIds.size > 0
  const isFullAccess = access.canManagePeople

  if (!isManager && !access.canUploadExternalScrims) {
    return 'Insufficient permissions. Only admins, staff managers, and team managers can upload scrims.'
  }
  if (opts.teamId != null && opts.externalTeamName) {
    return 'A scrim cannot be linked to both an org team and an external team name.'
  }
  if (opts.externalTeamName && !isFullAccess && !access.canUploadExternalScrims) {
    return 'External-team uploads require the external scrim uploader permission.'
  }
  if (!isManager) {
    // Flag-only coach: must be an external upload
    if (opts.teamId != null) {
      return 'Your permission only covers external-team scrims, not org teams.'
    }
    if (!opts.externalTeamName) {
      return 'Enter the external team name this scrim belongs to.'
    }
  }
  return null
}

/**
 * Which of the requested team ids fall outside the caller's upload scope.
 * Staff (canManagePeople) have full access; everyone else is limited to their
 * resolved team access (matching the scrim-rename / scrim-score-override rules).
 */
export function teamIdsOutsideScope(access: ResolvedAccess, requestedTeamIds: number[]): number[] {
  if (access.canManagePeople) return []
  return requestedTeamIds.filter((id) => !access.teamIds.has(id))
}
