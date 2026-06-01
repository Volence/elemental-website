import { describe, it, expect } from 'vitest'
import { parseScrimLog, validateScrimLog } from '../../src/lib/scrim-parser/parser'

/**
 * Overwatch's mature-language filter masks the 4-letter word "kill" as "****"
 * in Log To Inspector output. Logs uploaded from a client with the filter on
 * carry kill events under the "****" event type instead of "kill". The parser
 * must treat these as kills, otherwise every kill-derived stat (fights, first
 * picks/deaths, K/Ult, drought, killfeed, charts) silently shows nothing.
 */
const PLAYER_STAT_LINE =
  '[00:00:01] ,player_stat,0,1,Team 1,Exo,Tracer,3,2,1,1000,0,900,0,0,0,500,0,0,0,1,1,0,0,0,0,0,0,5,50,40,30,2,100,80,20,0,0,0,80,120'

const CENSORED_KILL_LOG = [
  '[00:00:00] ,match_start,0,Ilios,Control,Team 1,Team 2',
  PLAYER_STAT_LINE,
  '[00:00:02] ,****,43.20,Team 1,Exo,Tracer,Team 2,Maverick,D.Va,Melee,28.50,0,0',
  '[00:00:03] ,****,54.33,Team 1,Exo,Tracer,Team 2,Boss,Ashe,Primary Fire,2.92,True,0',
  '[00:00:04] ,kill,60.00,Team 2,Boss,Ashe,Team 1,Exo,Tracer,Primary Fire,150,True,0',
].join('\n')

describe('parseScrimLog - censored kill events', () => {
  it('parses "****"-censored kill lines alongside literal kill lines', () => {
    const data = parseScrimLog(CENSORED_KILL_LOG)
    expect(data.kill).toBeDefined()
    expect(data.kill).toHaveLength(3) // 2 censored + 1 literal
  })

  it('keeps the censored kill payload intact (attacker/victim/ability columns)', () => {
    const data = parseScrimLog(CENSORED_KILL_LOG)
    const first = data.kill[0]
    // [event_type, match_time, atkTeam, atkName, atkHero, vicTeam, vicName, vicHero, ability, dmg, crit, env]
    expect(first[0]).toBe('kill')
    expect(first[2]).toBe('Team 1') // attacker team
    expect(first[3]).toBe('Exo') // attacker name
    expect(first[6]).toBe('Maverick') // victim name
    expect(first[8]).toBe('Melee') // event ability
  })

  it('does not leave a "****" bucket on the parsed data', () => {
    const data = parseScrimLog(CENSORED_KILL_LOG) as Record<string, unknown>
    expect(data['****']).toBeUndefined()
    expect(data['0']).toBeUndefined()
  })
})

describe('validateScrimLog - censored kills', () => {
  it('counts "****" lines as recognized kill events for the validity threshold', () => {
    // A combat-heavy log dominated by censored kills must still validate.
    const lines = ['[00:00:00] ,match_start,0,Ilios,Control,Team 1,Team 2', PLAYER_STAT_LINE]
    for (let i = 0; i < 20; i++) {
      lines.push(
        `[00:00:0${i % 10}] ,****,${i}.0,Team 1,Exo,Tracer,Team 2,Boss,Ashe,Primary Fire,150,0,0`,
      )
    }
    expect(validateScrimLog(lines.join('\n'))).toBeNull()
  })
})
