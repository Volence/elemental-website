/**
 * Guards for the scrim-upload route.
 *
 * 1. Malformed player-mapping JSON must be a hard error, not silently
 *    ignored - a scrim uploaded with zero person linkage looks fine but
 *    breaks side resolution and every person-scoped stat.
 * 2. A team-manager may only upload scrims attributed to their assigned
 *    teams (rename/score-override already enforce this; upload didn't).
 */

import { describe, it, expect } from 'vitest'
import {
  parsePlayerMappings,
  teamIdsOutsideScope,
  validateUploadTarget,
} from '@/lib/scrim-analytics/upload-guards'

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
    expect(teamIdsOutsideScope('admin', [], [4, 9])).toEqual([])
    expect(teamIdsOutsideScope('staff-manager', [], [4])).toEqual([])
  })

  it('permits a team-manager uploading for an assigned team', () => {
    expect(teamIdsOutsideScope('team-manager', [4, 9], [4])).toEqual([])
  })

  it('rejects a team-manager uploading for an unassigned team', () => {
    expect(teamIdsOutsideScope('team-manager', [4], [9])).toEqual([9])
  })

  it('checks the second (internal-scrim) team as well', () => {
    expect(teamIdsOutsideScope('team-manager', [4], [4, 12])).toEqual([12])
  })
})

describe('validateUploadTarget (external team uploads)', () => {
  const mk = (o: Partial<Parameters<typeof validateUploadTarget>[0]>) =>
    validateUploadTarget({
      role: 'team-manager',
      canUploadExternalScrims: false,
      teamId: null,
      externalTeamName: null,
      ...o,
    })

  it('allows a manager role to upload a normal team scrim', () => {
    expect(mk({ teamId: 4 })).toBeNull()
  })

  it('rejects a flag-less user with no manager role entirely', () => {
    expect(mk({ role: 'player', teamId: 4 })).toMatch(/permission/i)
  })

  it('allows a flagged coach to upload for an external team', () => {
    expect(
      mk({ role: 'player', canUploadExternalScrims: true, externalTeamName: 'Other Org' }),
    ).toBeNull()
  })

  it('rejects a flagged coach uploading an org-team scrim', () => {
    expect(mk({ role: 'player', canUploadExternalScrims: true, teamId: 4 })).toMatch(/external/i)
  })

  it('rejects an external upload from an unflagged manager', () => {
    expect(mk({ externalTeamName: 'Other Org' })).toMatch(/external/i)
  })

  it('allows admins to upload external scrims without the flag', () => {
    expect(mk({ role: 'admin', externalTeamName: 'Other Org' })).toBeNull()
  })

  it('rejects mixing a linked team with an external team name', () => {
    expect(
      mk({ role: 'admin', teamId: 4, externalTeamName: 'Other Org' }),
    ).toMatch(/both/i)
  })

  it('rejects an upload with neither a team nor an external name for flag-only users', () => {
    expect(mk({ role: 'player', canUploadExternalScrims: true })).toMatch(/team/i)
  })
})
