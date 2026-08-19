/**
 * Unit tests for majority-based "our side" resolution.
 */

import { describe, it, expect } from 'vitest'
import { buildSideLookup, resolveOurSide } from '@/lib/scrim-analytics/our-side'

const MAP = 100
const SHADE = 70
const POISON = 69

describe('buildSideLookup', () => {
  it('picks the side with the majority of rostered players', () => {
    const sides = buildSideLookup([
      { mapDataId: MAP, teamId: SHADE, side: 'Team 1', players: 5 },
      // one Shade-rostered player ringing on the other side
      { mapDataId: MAP, teamId: SHADE, side: 'Team 2', players: 1 },
    ])
    expect(sides.get(`${MAP}:${SHADE}`)).toBe('Team 1')
  })

  it('leaves ties unresolved instead of picking arbitrarily', () => {
    const sides = buildSideLookup([
      { mapDataId: MAP, teamId: SHADE, side: 'Team 1', players: 2 },
      { mapDataId: MAP, teamId: SHADE, side: 'Team 2', players: 2 },
    ])
    expect(sides.has(`${MAP}:${SHADE}`)).toBe(false)
  })

  it('accumulates multiple rows for the same side', () => {
    const sides = buildSideLookup([
      { mapDataId: MAP, teamId: SHADE, side: 'Team 2', players: 2 },
      { mapDataId: MAP, teamId: SHADE, side: 'Team 1', players: 3 },
      { mapDataId: MAP, teamId: SHADE, side: 'Team 2', players: 2 },
    ])
    expect(sides.get(`${MAP}:${SHADE}`)).toBe('Team 2')
  })
})

describe('resolveOurSide', () => {
  const sides = buildSideLookup([
    { mapDataId: MAP, teamId: POISON, side: 'Team 2', players: 5 },
  ])

  it('resolves directly from the viewed team roster when available', () => {
    const withDirect = buildSideLookup([
      { mapDataId: MAP, teamId: SHADE, side: 'Team 1', players: 5 },
      { mapDataId: MAP, teamId: POISON, side: 'Team 2', players: 5 },
    ])
    expect(
      resolveOurSide({ mapDataId: MAP, viewTeamId: SHADE, otherTeamId: POISON, sides: withDirect, rawTeam1: 'Team 1', rawTeam2: 'Team 2' }),
    ).toBe('Team 1')
  })

  it('inverts the other linked team side when the viewed team is unmapped', () => {
    expect(
      resolveOurSide({ mapDataId: MAP, viewTeamId: SHADE, otherTeamId: POISON, sides, rawTeam1: 'Team 1', rawTeam2: 'Team 2' }),
    ).toBe('Team 1')
  })

  it('returns null when neither team resolves', () => {
    expect(
      resolveOurSide({ mapDataId: MAP, viewTeamId: SHADE, otherTeamId: null, sides, rawTeam1: 'Team 1', rawTeam2: 'Team 2' }),
    ).toBeNull()
    expect(
      resolveOurSide({ mapDataId: 999, viewTeamId: SHADE, otherTeamId: POISON, sides, rawTeam1: 'Team 1', rawTeam2: 'Team 2' }),
    ).toBeNull()
  })
})

describe('resolveOurSide uploader-side fallback', () => {
  const emptySides = buildSideLookup([])

  it('falls back to the persisted uploader side when the viewer IS the uploading team', () => {
    expect(
      resolveOurSide({
        mapDataId: MAP, viewTeamId: SHADE, otherTeamId: null, sides: emptySides,
        rawTeam1: 'Team 1', rawTeam2: 'Team 2',
        uploaderSideRaw: 'Team 2', uploaderTeamId: SHADE,
      }),
    ).toBe('Team 2')
  })

  it('inverts the uploader side when the viewer is the second linked team', () => {
    // ourSideRaw is uploader-perspective; POISON (team2) is on the other side
    expect(
      resolveOurSide({
        mapDataId: MAP, viewTeamId: POISON, otherTeamId: SHADE, sides: emptySides,
        rawTeam1: 'Team 1', rawTeam2: 'Team 2',
        uploaderSideRaw: 'Team 2', uploaderTeamId: SHADE,
      }),
    ).toBe('Team 1')
  })

  it('ignores the uploader side when the viewer is not linked to the uploader', () => {
    expect(
      resolveOurSide({
        mapDataId: MAP, viewTeamId: POISON, otherTeamId: null, sides: emptySides,
        rawTeam1: 'Team 1', rawTeam2: 'Team 2',
        uploaderSideRaw: 'Team 2', uploaderTeamId: SHADE,
      }),
    ).toBeNull()
  })

  it('ignores an uploader side that matches neither raw side label', () => {
    expect(
      resolveOurSide({
        mapDataId: MAP, viewTeamId: SHADE, otherTeamId: null, sides: emptySides,
        rawTeam1: 'Team 1', rawTeam2: 'Team 2',
        uploaderSideRaw: 'Cats', uploaderTeamId: SHADE,
      }),
    ).toBeNull()
  })

  it('prefers roster resolution over the uploader side', () => {
    const withDirect = buildSideLookup([
      { mapDataId: MAP, teamId: SHADE, side: 'Team 1', players: 5 },
    ])
    expect(
      resolveOurSide({
        mapDataId: MAP, viewTeamId: SHADE, otherTeamId: null, sides: withDirect,
        rawTeam1: 'Team 1', rawTeam2: 'Team 2',
        uploaderSideRaw: 'Team 2', uploaderTeamId: SHADE,
      }),
    ).toBe('Team 1')
  })
})
