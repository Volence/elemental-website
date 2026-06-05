import { describe, it, expect } from 'vitest'
import { diffSnapshots } from '../../src/components/PugLiveMatch/diffSnapshots'
import type { LiveSnapshot } from '../../src/components/PugLiveMatch/types'

const player = (o: Partial<any> = {}) => ({
  team: 'Team 1', hero: 'Hazard', eliminations: 0, finalBlows: 0, deaths: 0,
  damageDelt: 0, heroDamage: 0, barrierDamage: 0, healingDealt: 0,
  ultimatesEarned: 0, ultimatesUsed: 0, ...o,
})

const snap = (t1: Record<string, any>, t2: Record<string, any>): LiveSnapshot => ({
  map: 'Lijiang Tower', mapType: 'Control',
  team1: { name: 'Team 1', score: 0, players: t1 },
  team2: { name: 'Team 2', score: 0, players: t2 },
  round: 1, matchTime: 60, matchEnded: false, matchResult: null, eventCount: 10,
})

describe('diffSnapshots', () => {
  it('first call (prev null) yields no flashes or activity', () => {
    const d = diffSnapshots(null, snap({ Vex: player({ eliminations: 3 }) }, {}))
    expect(d.changed.size).toBe(0)
    expect(d.activity).toEqual([])
  })

  it('flags increased stats and derives kill/death activity', () => {
    const prev = snap({ Vex: player({ eliminations: 3, finalBlows: 2, deaths: 1 }) },
                      { Bengus: player({ team: 'Team 2', deaths: 0 }) })
    const next = snap({ Vex: player({ eliminations: 4, finalBlows: 3, deaths: 1 }) },
                      { Bengus: player({ team: 'Team 2', deaths: 1 }) })
    const d = diffSnapshots(prev, next)
    expect(d.changed.has('1:Vex:eliminations')).toBe(true)
    expect(d.changed.has('1:Vex:finalBlows')).toBe(true)
    expect(d.activity).toContainEqual({ kind: 'kill', player: 'Vex', team: 1 })
    expect(d.activity).toContainEqual({ kind: 'death', player: 'Bengus', team: 2 })
  })

  it('picks leaders by elims / heroDamage / healing across both teams', () => {
    const d = diffSnapshots(null, snap(
      { Vex: player({ eliminations: 5, heroDamage: 9000 }) },
      { lay: player({ team: 'Team 2', healingDealt: 7000 }), zombie: player({ team: 'Team 2', eliminations: 8, heroDamage: 12000 }) },
    ))
    expect(d.leaders.elims).toBe('zombie')
    expect(d.leaders.damage).toBe('zombie')
    expect(d.leaders.healing).toBe('lay')
  })
})
