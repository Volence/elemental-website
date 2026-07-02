/**
 * Unit tests for scrim opponent-name resolution.
 *
 * Locks the priority order used by /api/scrims and /api/scrim-team-stats:
 *   1. Linked opposing Payload team (payloadTeamId/payloadTeamId2)
 *   2. Free-text opponentName override (uploader's perspective only)
 *   3. Raw log side that isn't ours (roster-resolved, fallback team1)
 *
 * Regression cases come from prod scrims 77 ("vs Poison" showing "Team 2")
 * and 70 ("vs Abyss" showing "Cats" on the second team's Opponents tab).
 */

import { describe, it, expect } from 'vitest'
import { resolveOpponentName } from '@/lib/scrim-analytics/opponent'

const SHADE = 70
const POISON = 69
const ABYSS = 95

const teamNames = new Map<number, string>([
  [SHADE, 'Shade'],
  [POISON, 'Poison'],
  [ABYSS, 'Abyss'],
])

describe('resolveOpponentName', () => {
  it('resolves the linked second team instead of the raw "Team 2" log name (prod scrim 77)', () => {
    // Shade uploaded vs Poison, both teams linked, no free-text opponent,
    // log only contains generic side names.
    expect(
      resolveOpponentName({
        viewTeamId: SHADE,
        payloadTeamId: SHADE,
        payloadTeamId2: POISON,
        opponentName: null,
        linkedTeamNames: teamNames,
        rawTeam1: 'Team 1',
        rawTeam2: 'Team 2',
        rawOurTeam: 'Team 1',
      }),
    ).toBe('Poison')
  })

  it('resolves the primary linked team when viewing as the second team (prod scrim 70)', () => {
    // Abyss uploaded with Shade linked as team 2 and typed "Cats" as opponent.
    // From Shade's perspective the opponent is Abyss, not "Cats".
    expect(
      resolveOpponentName({
        viewTeamId: SHADE,
        payloadTeamId: ABYSS,
        payloadTeamId2: SHADE,
        opponentName: 'Cats',
        linkedTeamNames: teamNames,
        rawTeam1: 'Dogs',
        rawTeam2: 'Cats',
        rawOurTeam: 'Dogs',
      }),
    ).toBe('Abyss')
  })

  it('prefers the linked team name over the free-text override from the uploader perspective too', () => {
    expect(
      resolveOpponentName({
        viewTeamId: ABYSS,
        payloadTeamId: ABYSS,
        payloadTeamId2: SHADE,
        opponentName: 'Cats',
        linkedTeamNames: teamNames,
        rawTeam1: 'Dogs',
        rawTeam2: 'Cats',
        rawOurTeam: 'Cats',
      }),
    ).toBe('Shade')
  })

  it('uses the free-text override when no second team is linked', () => {
    expect(
      resolveOpponentName({
        viewTeamId: SHADE,
        payloadTeamId: SHADE,
        payloadTeamId2: null,
        opponentName: 'ROSOIDEAE Nightshade',
        linkedTeamNames: teamNames,
        rawTeam1: 'Team 1',
        rawTeam2: 'Team 2',
        rawOurTeam: 'Team 1',
      }),
    ).toBe('ROSOIDEAE Nightshade')
  })

  it('ignores the free-text override when viewing as the second team (it is the uploader perspective)', () => {
    // Second team linked but its name missing from the lookup: fall through
    // past opponentName (wrong perspective) to the raw log side.
    expect(
      resolveOpponentName({
        viewTeamId: SHADE,
        payloadTeamId: ABYSS,
        payloadTeamId2: SHADE,
        opponentName: 'Cats',
        linkedTeamNames: new Map<number, string>(),
        rawTeam1: 'Dogs',
        rawTeam2: 'Cats',
        rawOurTeam: 'Dogs',
      }),
    ).toBe('Cats')
  })

  it('falls back to the raw log side that is not ours', () => {
    expect(
      resolveOpponentName({
        viewTeamId: SHADE,
        payloadTeamId: SHADE,
        payloadTeamId2: null,
        opponentName: null,
        linkedTeamNames: teamNames,
        rawTeam1: 'Dogs',
        rawTeam2: 'Cats',
        rawOurTeam: 'Cats',
      }),
    ).toBe('Dogs')
  })

  it('assumes team 1 is ours when the roster gives no answer', () => {
    expect(
      resolveOpponentName({
        viewTeamId: SHADE,
        payloadTeamId: SHADE,
        payloadTeamId2: null,
        opponentName: null,
        linkedTeamNames: teamNames,
        rawTeam1: 'Team 1',
        rawTeam2: 'Team 2',
        rawOurTeam: null,
      }),
    ).toBe('Team 2')
  })

  it('resolves from the primary perspective when no view team is given (scrim list)', () => {
    expect(
      resolveOpponentName({
        viewTeamId: null,
        payloadTeamId: SHADE,
        payloadTeamId2: POISON,
        opponentName: null,
        linkedTeamNames: teamNames,
        rawTeam1: 'Team 1',
        rawTeam2: 'Team 2',
        rawOurTeam: 'Team 1',
      }),
    ).toBe('Poison')
  })
})
