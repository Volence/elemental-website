/**
 * Unit tests for parsing workshop logs whose position fields are formatted
 * vector strings like "(12.3, 4.5, -6.7)".
 *
 * The Workshop's Custom String renders a Vector value with parentheses and
 * embedded commas, so a naive comma split shreds it into "(12.3" / " 4.5" /
 * " -6.7)" - which is exactly how prod scrims 36/37 ended up with
 * attacker_x = NaN on all 666 kill positions. The parser must split
 * top-level commas only and expand vector tokens into three numeric columns.
 */

import { describe, it, expect } from 'vitest'
import { parseScrimLog, validateScrimLog } from '@/lib/scrim-parser/parser'

const TS = '[00:12:34]'

describe('parseScrimLog with vector-string positions', () => {
  it('expands attacker/victim position vectors on kill events into 6 numeric columns', () => {
    const log = [
      `${TS},kill,245.32,Team 1,Cajan,Tracer,Team 2,Mirky,Ana,Primary Fire,120,False,False,(-23.45, 16, -14.34),(1.23, 4.56, 7.89)`,
    ].join('\n')

    const data = parseScrimLog(log)
    expect(data.kill).toHaveLength(1)
    const kill = data.kill![0] as (string | number | null)[]
    // Base columns intact
    expect(kill[3]).toBe('Cajan')
    expect(kill[8]).toBe('Primary Fire')
    // Positions expanded to the documented flat layout (cols 12-17)
    expect(kill.slice(12, 18)).toEqual([-23.45, 16, -14.34, 1.23, 4.56, 7.89])
  })

  it('still accepts the flat numeric position layout', () => {
    const log = `${TS},kill,245.32,Team 1,Cajan,Tracer,Team 2,Mirky,Ana,Primary Fire,120,False,False,-23.45,16,-14.34,1.23,4.56,7.89`
    const data = parseScrimLog(log)
    const kill = data.kill![0] as (string | number | null)[]
    expect(kill.slice(12, 18)).toEqual([-23.45, 16, -14.34, 1.23, 4.56, 7.89])
  })

  it('expands vector positions on player_position events', () => {
    const log = `${TS},player_position,12.5,Team 1,Cajan,Tracer,(10.5, 2, -30.25),55,True,0.7,0.7,150,False,True`
    const data = parseScrimLog(log)
    expect(data.player_position).toHaveLength(1)
    const row = data.player_position![0] as (string | number | null)[]
    // event_type, match_time, team, name, hero, x, y, z, ult, alive, ...
    expect(row.slice(5, 8)).toEqual([10.5, 2, -30.25])
    expect(row[8]).toBe(55)
  })

  it('expands vector positions on kill_position companion events', () => {
    const log = `${TS},kill_position,245.32,(-23.45, 16, -14.34),(1.23, 4.56, 7.89)`
    const data = parseScrimLog(log)
    const row = data.kill_position![0] as (string | number | null)[]
    expect(row.slice(2, 8)).toEqual([-23.45, 16, -14.34, 1.23, 4.56, 7.89])
  })

  it('does not break map names containing parentheses', () => {
    const log = [
      `${TS},match_start,0.5,King's Row (Winter),Hybrid,Team 1,Team 2`,
      `${TS},kill,245.32,Team 1,Cajan,Tracer,Team 2,Mirky,Ana,Primary Fire,120,False,False`,
    ].join('\n')
    const data = parseScrimLog(log)
    expect(data.match_start![0][2]).toBe("King's Row (Winter)")
    expect(data.match_start![0][3]).toBe('Hybrid')
    // kill without positions keeps its base 12 columns
    expect(data.kill![0]).toHaveLength(12)
  })

  it('leaves non-numeric parenthesized tokens alone', () => {
    // A hypothetical string field with parens but no numeric triple inside
    const log = `${TS},match_start,0.5,Busan (Lunar New Year),Control,Dogs,Cats`
    const data = parseScrimLog(log)
    expect(data.match_start![0][2]).toBe('Busan (Lunar New Year)')
  })

  it('validateScrimLog accepts a log whose kills carry vector positions', () => {
    const lines = [
      `${TS},match_start,0.5,Numbani,Hybrid,Team 1,Team 2`,
      `${TS},kill,245.32,Team 1,Cajan,Tracer,Team 2,Mirky,Ana,Primary Fire,120,False,False,(-23.45, 16, -14.34),(1.23, 4.56, 7.89)`,
      `${TS},player_stat,300,1,Team 1,Cajan,Tracer,10,2,3,1000,500,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0`,
      `${TS},player_stat,300,1,Team 2,Mirky,Ana,1,5,0,200,100,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0`,
      `${TS},round_end,300,1,Team 1,1,0,0,0,0`,
    ]
    expect(validateScrimLog(lines.join('\n'))).toBeNull()
  })
})
