import { describe, it, expect } from 'vitest'
import {
  detectSeasons,
  leaguesFromTree,
  buildRolloverPlan,
  type FaceitSeasonInfo,
  type RolloverTeamInput,
  type ExistingLeagueInput,
} from '@/utilities/faceitRollover'

// Trimmed shape of team-leagues/v2/seasons/tree for Season 10
const TREE = {
  id: 's10',
  name: 'Season 10',
  number: 10,
  regions: [
    {
      name: 'North America', code: 'NA',
      divisions: [
        { name: 'OWCS', stages: [{ id: 'st-owcs', name: 'Regular Season', conferences: [{ id: 'c1', name: 'Central', championship_id: 'ch-owcs' }] }] },
        { name: 'OWCS P/R', stages: [{ id: 'st-pr', name: 'Stage 3', conferences: [{ id: 'c2', name: 'Bracket', championship_id: 'ch-pr' }] }] },
        { name: 'Master', stages: [
          { id: 'st-na-master', name: 'Regular Season', conferences: [{ id: 'c3', name: 'Central', championship_id: 'ch-na-master' }] },
          { id: 'st-na-master-po', name: 'Playoffs', conferences: [{ id: 'c4', name: 'Central', championship_id: 'ch-na-master-po' }] },
        ] },
        { name: 'Intermediate ', stages: [
          { id: 'st-na-int', name: 'Regular Season ', conferences: [{ id: 'c5', name: 'Central', championship_id: 'ch-na-int' }] },
        ] },
      ],
    },
    {
      name: 'EMEA', code: 'EMEA',
      divisions: [
        { name: 'Open', stages: [{ id: 'st-emea-open', name: 'Regular Season', conferences: [{ id: 'c6', name: 'Central', championship_id: 'ch-emea-open' }] }] },
        { name: 'Master Relegation', stages: [{ id: 'st-rel', name: 'Season 11', conferences: [{ id: 'c7', name: 'S11', championship_id: 'ch-rel' }] }] },
      ],
    },
    { name: 'China', code: 'CN', divisions: [{ name: 'Open', stages: [{ id: 'st-cn', name: 'Regular Season', conferences: [{ id: 'c8', name: 'Central', championship_id: 'ch-cn' }] }] }] },
  ],
}
const SEASON10: FaceitSeasonInfo = { id: 's10', number: 10, start: '2026-09-07T00:00:00Z', end: '2026-11-16T06:00:00Z' }

describe('leaguesFromTree', () => {
  const leagues = leaguesFromTree(TREE, SEASON10, 'league-1')

  it('keeps only tracked divisions and regions, regular season stages only', () => {
    expect(leagues.map((l) => l.name).sort()).toEqual(['Season 10 Intermediate NA', 'Season 10 Masters NA', 'Season 10 Open EMEA'])
  })

  it('normalises Master to Masters and trims stray spaces', () => {
    const masters = leagues.find((l) => l.stageId === 'st-na-master')!
    expect(masters.division).toBe('Masters')
    expect(masters.region).toBe('NA')
    expect(masters.championshipId).toBe('ch-na-master')
    expect(masters.conference).toBe('Central')
    expect(masters.key).toBe('s10:st-na-master')
    expect(leagues.find((l) => l.stageId === 'st-na-int')!.division).toBe('Intermediate')
  })

  it('carries the season and league ids', () => {
    for (const l of leagues) {
      expect(l.seasonId).toBe('s10')
      expect(l.leagueId).toBe('league-1')
      expect(l.seasonNumber).toBe(10)
      expect(l.existingId).toBeNull()
    }
  })

  it('returns nothing for a tree without regions', () => {
    expect(leaguesFromTree(null, SEASON10, 'league-1')).toEqual([])
    expect(leaguesFromTree({}, SEASON10, 'league-1')).toEqual([])
  })
})

const teams: RolloverTeamInput[] = [
  { id: 1, name: 'Garden', active: true, faceitEnabled: true, faceitTeamId: 'ft-garden', currentFaceitLeague: 23, currentLeagueName: 'Season 9 Masters NA' },
  { id: 2, name: 'Zenith', active: true, faceitEnabled: true, faceitTeamId: 'ft-zenith', currentFaceitLeague: 21, currentLeagueName: 'Season 9 Advanced NA' },
  { id: 3, name: 'Havoc', active: true, faceitEnabled: true, faceitTeamId: 'ft-wrong', currentFaceitLeague: null, currentLeagueName: null },
  { id: 4, name: 'Retired', active: false, faceitEnabled: false, faceitTeamId: null, currentFaceitLeague: 7, currentLeagueName: 'Season 7 Open NA' },
  { id: 5, name: 'Doubled', active: true, faceitEnabled: true, faceitTeamId: 'ft-double', currentFaceitLeague: null, currentLeagueName: null },
]
const existing: ExistingLeagueInput[] = [
  { id: 23, name: 'Season 9 Masters NA', seasonId: 's9', stageId: 'st9', isActive: true, seasonNumber: 9 },
  { id: 21, name: 'Season 9 Advanced NA', seasonId: 's9', stageId: 'st9b', isActive: false, seasonNumber: 9 },
  { id: 40, name: 'Season 10 Open EMEA', seasonId: 's10', stageId: 'st-emea-open', isActive: true, seasonNumber: 10 },
]
const subscriptions = new Map([
  ['ch-na-master', [{ teamId: 'ft-garden', name: 'ELMT Garden' }, { teamId: 'ft-double', name: 'ELMT Doubled' }]],
  ['ch-na-int', [{ teamId: 'ft-zenith', name: 'ELMT Zenith' }, { teamId: 'ft-havoc-real', name: 'ELMT Havoc' }, { teamId: 'ft-double', name: 'ELMT Doubled' }]],
  ['ch-emea-open', [{ teamId: 'ft-other', name: 'Some Other Team' }]],
])

describe('buildRolloverPlan', () => {
  const plan = buildRolloverPlan({ season: SEASON10, tree: TREE, teams, existingLeagues: existing, subscriptions, leagueId: 'league-1' })

  it('marks leagues that already exist by season and stage id', () => {
    const emea = plan.leagues.find((l) => l.stageId === 'st-emea-open')!
    expect(emea.existingId).toBe(40)
    expect(plan.leagues.find((l) => l.stageId === 'st-na-master')!.existingId).toBeNull()
  })

  it('assigns teams to the championship they registered in', () => {
    expect(plan.assignments).toEqual(expect.arrayContaining([
      expect.objectContaining({ teamId: 1, toKey: 's10:st-na-master', toName: 'Season 10 Masters NA', fromLeague: 'Season 9 Masters NA' }),
      expect.objectContaining({ teamId: 2, toKey: 's10:st-na-int', toName: 'Season 10 Intermediate NA' }),
    ]))
  })

  it('lists enabled teams it could not find, with ELMT-named suggestions', () => {
    const havoc = plan.unmatched.find((u) => u.teamId === 3)!
    expect(havoc.faceitTeamId).toBe('ft-wrong')
    expect(havoc.suggestions).toEqual([
      { faceitTeamId: 'ft-havoc-real', faceitName: 'ELMT Havoc', leagueKey: 's10:st-na-int', leagueName: 'Season 10 Intermediate NA' },
    ])
  })

  it('flags a team id registered in two championships instead of guessing', () => {
    expect(plan.conflicts).toEqual([{ teamId: 5, teamName: 'Doubled', leagueKeys: ['s10:st-na-master', 's10:st-na-int'] }])
    expect(plan.assignments.find((a) => a.teamId === 5)).toBeUndefined()
  })

  it('finalizes still-active leagues from older seasons only', () => {
    expect(plan.finalize).toEqual([{ id: 23, name: 'Season 9 Masters NA' }])
  })

  it('clears league pointers on teams that are not enabled or not active', () => {
    expect(plan.stalePointers).toEqual([{ teamId: 4, teamName: 'Retired', leagueName: 'Season 7 Open NA' }])
  })

  it('degrades to leagues only without subscriptions and says so', () => {
    const noSubs = buildRolloverPlan({ season: SEASON10, tree: TREE, teams, existingLeagues: existing, subscriptions: null, leagueId: 'league-1' })
    expect(noSubs.assignments).toEqual([])
    expect(noSubs.unmatched.map((u) => u.teamId).sort()).toEqual([1, 2, 3, 5])
    expect(noSubs.warnings.join(' ')).toMatch(/FACEIT_API_KEY/)
  })
})

const seasons: FaceitSeasonInfo[] = [
  { id: 's10', number: 10, start: '2026-09-07T00:00:00Z', end: '2026-11-16T06:00:00Z' },
  { id: 's9', number: 9, start: '2026-06-15T00:00:00Z', end: '2026-08-17T05:00:00Z' },
  { id: 's8', number: 8, start: '2026-03-16T01:00:00Z', end: '2026-05-25T21:00:00Z' },
]

describe('detectSeasons', () => {
  it('picks the highest published season number as latest', () => {
    const d = detectSeasons(seasons, 9)
    expect(d.latest?.number).toBe(10)
    expect(d.latest?.id).toBe('s10')
    expect(d.ours).toBe(9)
    expect(d.rolloverAvailable).toBe(true)
  })

  it('reports nothing to do when we already track the latest season', () => {
    expect(detectSeasons(seasons, 10).rolloverAvailable).toBe(false)
  })

  it('offers a rollover when we track no season at all', () => {
    const d = detectSeasons(seasons, null)
    expect(d.ours).toBeNull()
    expect(d.rolloverAvailable).toBe(true)
  })

  it('handles an empty season list', () => {
    const d = detectSeasons([], 9)
    expect(d.latest).toBeNull()
    expect(d.rolloverAvailable).toBe(false)
  })
})
