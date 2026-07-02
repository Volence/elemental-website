/**
 * Unit tests for the map content signature used by duplicate-upload detection.
 */

import { describe, it, expect } from 'vitest'
import { parseScrimLog } from '@/lib/scrim-parser/parser'
import { mapSignatureFromParsedData } from '@/lib/scrim-analytics/duplicate-detection'

const TS = '[00:12:34]'

function log(lines: string[]): ReturnType<typeof parseScrimLog> {
  return parseScrimLog(lines.join('\n'))
}

describe('mapSignatureFromParsedData', () => {
  it('builds a signature from map name and kill timestamps', () => {
    const data = log([
      `${TS},match_start,1.0,Numbani,Hybrid,Team 1,Team 2`,
      `${TS},kill,45.12,Team 1,A,Tracer,Team 2,B,Ana,Primary Fire,150,False,False`,
      `${TS},kill,12.50,Team 2,B,Ana,Team 1,A,Tracer,Primary Fire,200,False,False`,
      `${TS},kill,300.99,Team 1,A,Tracer,Team 2,B,Ana,Melee,30,False,False`,
    ])
    expect(mapSignatureFromParsedData(data)).toEqual({
      mapName: 'Numbani',
      kills: 3,
      firstKillTime: 12.5,
      lastKillTime: 300.99,
    })
  })

  it('is identical for the same log parsed twice (re-upload)', () => {
    const lines = [
      `${TS},match_start,1.0,Dorado,Escort,Dogs,Cats`,
      `${TS},kill,18.62,Dogs,A,Tracer,Cats,B,Ana,Primary Fire,150,False,False`,
      `${TS},kill,855.46,Cats,B,Ana,Dogs,A,Tracer,Primary Fire,200,False,False`,
    ]
    expect(mapSignatureFromParsedData(log(lines))).toEqual(mapSignatureFromParsedData(log(lines)))
  })

  it('handles kill-less logs without a signature crash', () => {
    const data = log([`${TS},match_start,1.0,Oasis,Control,Team 1,Team 2`])
    expect(mapSignatureFromParsedData(data)).toEqual({
      mapName: 'Oasis',
      kills: 0,
      firstKillTime: null,
      lastKillTime: null,
    })
  })

  it('returns null without a match_start', () => {
    expect(mapSignatureFromParsedData(log([`${TS},round_start,1.0,1,Team 1,0,0,0`]))).toBeNull()
  })
})
