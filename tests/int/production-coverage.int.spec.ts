import { describe, it, expect } from 'vitest'
import { computeCoverageStatus, producerDirectorOverlap } from '@/utilities/productionCoverage'

describe('computeCoverageStatus', () => {
  it('is none when nobody is assigned', () => {
    expect(computeCoverageStatus({})).toBe('none')
    expect(computeCoverageStatus({ assignedObservers: [], assignedProducers: [], assignedCasters: [] })).toBe('none')
  })

  it('is full at the minimums: one observer, one producer, two casters', () => {
    expect(computeCoverageStatus({
      assignedObservers: [1],
      assignedProducers: [2],
      assignedCasters: [{ user: 3 }, { user: 4 }],
    })).toBe('full')
  })

  it('stays full when a role is over-staffed', () => {
    expect(computeCoverageStatus({
      assignedObservers: [1, 5, 6],
      assignedProducers: [2, 7],
      assignedCasters: [{ user: 3 }, { user: 4 }, { user: 8 }],
    })).toBe('full')
  })

  it('is partial with only one caster', () => {
    expect(computeCoverageStatus({
      assignedObservers: [1],
      assignedProducers: [2],
      assignedCasters: [{ user: 3 }],
    })).toBe('partial')
  })

  it('is partial when a role is missing entirely', () => {
    expect(computeCoverageStatus({ assignedObservers: [1], assignedCasters: [{ user: 3 }, { user: 4 }] })).toBe('partial')
    expect(computeCoverageStatus({ assignedProducers: [2], assignedCasters: [{ user: 3 }, { user: 4 }] })).toBe('partial')
  })

  it('does not require a director for full coverage', () => {
    expect(computeCoverageStatus({
      assignedObservers: [1],
      assignedProducers: [2],
      assignedDirectors: [],
      assignedCasters: [{ user: 3 }, { user: 4 }],
    })).toBe('full')
  })

  it('counts a lone director as partial rather than none', () => {
    expect(computeCoverageStatus({ assignedDirectors: [9] })).toBe('partial')
  })

  it('reads relationships whatever depth they arrive at', () => {
    expect(computeCoverageStatus({
      assignedObservers: [{ id: 1 }],
      assignedProducers: [{ id: 2 }],
      assignedCasters: [{ user: { id: 3 } }, { user: { id: 4 } }],
    })).toBe('full')
  })
})

describe('producerDirectorOverlap', () => {
  it('is empty when the two roles hold different people', () => {
    expect(producerDirectorOverlap({ assignedProducers: [1, 2], assignedDirectors: [3] })).toEqual([])
  })

  it('is empty when either role is unset', () => {
    expect(producerDirectorOverlap({ assignedProducers: [1] })).toEqual([])
    expect(producerDirectorOverlap({ assignedDirectors: [1] })).toEqual([])
  })

  it('names anyone holding both roles on the same match', () => {
    expect(producerDirectorOverlap({ assignedProducers: [1, 2], assignedDirectors: [2, 3] })).toEqual([2])
  })

  it('matches on id regardless of depth', () => {
    expect(producerDirectorOverlap({ assignedProducers: [{ id: 7 }], assignedDirectors: [7] })).toEqual([7])
  })
})
