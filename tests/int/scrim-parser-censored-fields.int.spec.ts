/**
 * The OW text filter censors profane words with asterisks anywhere in a log
 * line - including player and team names. The parser's asterisk scrub exists
 * to keep censored NUMERIC fields from reaching the DB as NaN, but it must
 * not rewrite identity columns: a player named "As***in" (or fully censored
 * "****") was previously flattened to "0", silently merging them with every
 * other censored player and breaking name-based joins.
 */

import { describe, it, expect } from 'vitest'
import { parseScrimLog } from '@/lib/scrim-parser/parser'
import { headers } from '@/lib/scrim-parser/headers'

const TS = '[00:12:34]'

describe('censored (asterisk) field handling', () => {
  it('preserves a partially censored player name', () => {
    const log = `${TS},kill,245.32,Team 1,As***in,Tracer,Team 2,Mirky,Ana,Primary Fire,120,False,False`
    const kill = parseScrimLog(log).kill![0] as (string | number | null)[]
    expect(kill[3]).toBe('As***in')
  })

  it('preserves a fully censored player name as "****" rather than "0"', () => {
    const log = `${TS},kill,245.32,Team 1,****,Tracer,Team 2,Mirky,Ana,Primary Fire,120,False,False`
    const kill = parseScrimLog(log).kill![0] as (string | number | null)[]
    expect(kill[3]).toBe('****')
  })

  it('preserves a censored team name', () => {
    const log = `${TS},hero_swap,100.00,Da**Cats,Player1,Tracer,Sombra,45.2`
    const swap = parseScrimLog(log).hero_swap![0] as (string | number | null)[]
    expect(swap[2]).toBe('Da**Cats')
  })

  it('still scrubs asterisks in numeric columns to 0', () => {
    const log = `${TS},kill,245.32,Team 1,Cajan,Tracer,Team 2,Mirky,Ana,Primary Fire,***,False,False`
    const kill = parseScrimLog(log).kill![0] as (string | number | null)[]
    expect(kill[9]).toBe(0) // Event Damage
  })

  it('still un-censors a fully censored kill event type', () => {
    const log = `${TS},****,245.32,Team 1,Cajan,Tracer,Team 2,Mirky,Ana,Primary Fire,120,False,False`
    const data = parseScrimLog(log)
    expect(data.kill).toHaveLength(1)
  })
})

describe('headers contract', () => {
  it('documents dva_remech col 5 as the Ultimate ID (matches types.ts/storage.ts)', () => {
    // Workshop source (docs/elemental-scrimtime.txt:2652) logs
    // ",dva_remech,{time},{team},{player},{hero},{UltimateID}".
    expect(headers.dva_remech[5]).toBe('Ultimate ID')
  })
})
