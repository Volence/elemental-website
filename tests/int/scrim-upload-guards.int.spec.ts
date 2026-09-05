/**
 * Guards for the scrim-upload route.
 *
 * 1. Malformed player-mapping JSON must be a hard error, not silently
 *    ignored - a scrim uploaded with zero person linkage looks fine but
 *    breaks side resolution and every person-scoped stat.
 * 2. A person with team access may only upload scrims attributed to their
 *    assigned teams (rename/score-override already enforce this; upload didn't).
 */

import { describe, it, expect } from 'vitest'
import {
  parsePlayerMappings,
  teamIdsOutsideScope,
  validateUploadTarget,
} from '@/lib/scrim-analytics/upload-guards'
import { resolveAccess, type ResolvedAccess } from '@/access'

/** Builds a ResolvedAccess fixture: `teamIds` grants team access via teamAccess, independent of role. */
function buildAccess(opts: { role?: string; teamIds?: number[]; canUploadExternalScrims?: boolean } = {}): ResolvedAccess {
  const { role = 'user', teamIds = [], canUploadExternalScrims = false } = opts
  return resolveAccess(
    {
      id: 1,
      role,
      teamAccess: teamIds,
      departments: canUploadExternalScrims ? { canUploadExternalScrims: true } : {},
    },
    [],
  )
}

describe('parsePlayerMappings', () => {
  it('parses a valid mapping object', () => {
    expect(parsePlayerMappings('{"Cajan": 5, "Mirky": "7"}')).toEqual({ Cajan: 5, Mirky: 7 })
  })

  it('drops null/non-numeric entries', () => {
    expect(parsePlayerMappings('{"A": null, "B": "x", "C": 3}')).toEqual({ C: 3 })
  })

  it('returns empty object for absent input', () => {
    expect(parsePlayerMappings(null)).toEqual({})
  })

  it('returns null (hard error) for malformed JSON', () => {
    expect(parsePlayerMappings('{oops')).toBeNull()
  })

  it('returns null for non-object JSON', () => {
    expect(parsePlayerMappings('[1,2]')).toBeNull()
    expect(parsePlayerMappings('"str"')).toBeNull()
  })
})

describe('teamIdsOutsideScope', () => {
  it('permits full-access roles regardless of assignment', () => {
    expect(teamIdsOutsideScope(buildAccess({ role: 'admin' }), [4, 9])).toEqual([])
    expect(teamIdsOutsideScope(buildAccess({ role: 'staff-manager' }), [4])).toEqual([])
  })

  it('permits a person with team access uploading for an assigned team', () => {
    expect(teamIdsOutsideScope(buildAccess({ teamIds: [4, 9] }), [4])).toEqual([])
  })

  it('rejects a person uploading for an unassigned team', () => {
    expect(teamIdsOutsideScope(buildAccess({ teamIds: [4] }), [9])).toEqual([9])
  })

  it('checks the second (internal-scrim) team as well', () => {
    expect(teamIdsOutsideScope(buildAccess({ teamIds: [4] }), [4, 12])).toEqual([12])
  })
})

describe('validateUploadTarget (external team uploads)', () => {
  const mk = (o: {
    accessTeamIds?: number[]
    accessRole?: string
    canUploadExternalScrims?: boolean
    teamId?: number | null
    externalTeamName?: string | null
  }) =>
    validateUploadTarget({
      access: buildAccess({
        role: o.accessRole ?? 'user',
        teamIds: o.accessTeamIds ?? [4],
        canUploadExternalScrims: o.canUploadExternalScrims ?? false,
      }),
      teamId: o.teamId ?? null,
      externalTeamName: o.externalTeamName ?? null,
    })

  it('allows a person with team access to upload a normal team scrim', () => {
    expect(mk({ teamId: 4 })).toBeNull()
  })

  it('rejects a flag-less user with no team access entirely', () => {
    expect(mk({ accessTeamIds: [], teamId: 4 })).toMatch(/permission/i)
  })

  it('allows a flagged coach to upload for an external team', () => {
    expect(
      mk({ accessTeamIds: [], canUploadExternalScrims: true, externalTeamName: 'Other Org' }),
    ).toBeNull()
  })

  it('rejects a flagged coach uploading an org-team scrim', () => {
    expect(mk({ accessTeamIds: [], canUploadExternalScrims: true, teamId: 4 })).toMatch(/external/i)
  })

  it('rejects an external upload from an unflagged manager', () => {
    expect(mk({ externalTeamName: 'Other Org' })).toMatch(/external/i)
  })

  it('allows admins to upload external scrims without the flag', () => {
    expect(mk({ accessRole: 'admin', externalTeamName: 'Other Org' })).toBeNull()
  })

  it('rejects mixing a linked team with an external team name', () => {
    expect(
      mk({ accessRole: 'admin', teamId: 4, externalTeamName: 'Other Org' }),
    ).toMatch(/both/i)
  })

  it('rejects an upload with neither a team nor an external name for flag-only users', () => {
    expect(mk({ accessTeamIds: [], canUploadExternalScrims: true })).toMatch(/team/i)
  })
})
