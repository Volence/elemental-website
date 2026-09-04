import { describe, it, expect } from 'vitest'
import { FACEIT_DIVISIONS, divisionFromRating, divisionRank, isFaceitDivision } from '@/utilities/divisions'
import { getTierFromRating, tierColors } from '@/utilities/tierColors'
import { sortTeams } from '@/utilities/sortTeams'

describe('FACEIT divisions', () => {
  it('orders Intermediate between Advanced and Open', () => {
    expect(FACEIT_DIVISIONS).toEqual(['Masters', 'Expert', 'Advanced', 'Intermediate', 'Open'])
    expect(divisionRank('Intermediate')).toBeGreaterThan(divisionRank('Advanced'))
    expect(divisionRank('Intermediate')).toBeLessThan(divisionRank('Open'))
    expect(divisionRank('Other')).toBe(FACEIT_DIVISIONS.length)
    expect(isFaceitDivision('Intermediate')).toBe(true)
    expect(isFaceitDivision('4.5K')).toBe(false)
  })

  it('reads the division out of free-text ratings, case and whitespace aside', () => {
    expect(divisionFromRating('FACEIT Intermediate ')).toBe('Intermediate')
    expect(divisionFromRating('faceit open')).toBe('Open')
    expect(divisionFromRating('FACEIT advanced')).toBe('Advanced')
    expect(divisionFromRating('Masters')).toBe('Masters')
    expect(divisionFromRating('4.5K')).toBeNull()
    expect(divisionFromRating(null)).toBeNull()
  })

  it('gives Intermediate and Open their own colours', () => {
    expect(getTierFromRating('FACEIT Intermediate')).toBe(tierColors.intermediate)
    expect(getTierFromRating('FACEIT Open')).toBe(tierColors.open)
    expect(getTierFromRating('FACEIT Advanced')).toBe(tierColors.advanced)
    expect(getTierFromRating('4.5K')).toBe(tierColors.tier4k)
    expect(tierColors.intermediate.borderColor).not.toBe(tierColors.advanced.borderColor)
    expect(tierColors.open.borderColor).not.toBe(tierColors.tierBelow.borderColor)
    expect(tierColors.open.borderColor).not.toBe(tierColors.tier4k.borderColor)
  })

  it('sorts the public teams page: divisions above SR numbers, Intermediate above Open', () => {
    const t = (name: string, rating: string) => ({ id: name, name, region: 'NA', rating }) as any
    const sorted = sortTeams([t('sr', '4.5K'), t('open', 'FACEIT Open'), t('inter', 'FACEIT Intermediate'), t('adv', 'FACEIT Advanced'), t('low', '3.5K')])
    expect(sorted.map((x) => x.name)).toEqual(['adv', 'inter', 'open', 'sr', 'low'])
  })
})
