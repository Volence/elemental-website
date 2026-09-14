import { describe, it, expect } from 'vitest'
import {
  signupLists,
  withSignup,
  withoutSignup,
  withAssignment,
  withoutAssignment,
  slotSignups,
  assignedElsewhere,
} from '@/utilities/productionSignups'

describe('signupLists', () => {
  it('drops duplicates a racing write left behind, keeping first order', () => {
    const lists = signupLists({
      observerSignups: [1324, 1324, 675, 675],
      producerSignups: [{ id: 675 }, 675],
      casterSignups: [
        { id: 'a', user: 1348, style: null },
        { id: 'b', user: { id: 1348 }, style: 'both' },
        { id: 'c', user: 718, style: 'color' },
      ],
    })
    expect(lists.observerSignups).toEqual([1324, 675])
    expect(lists.producerSignups).toEqual([675])
    expect(lists.casterSignups).toEqual([
      { id: 'a', user: 1348, style: null },
      { id: 'c', user: 718, style: 'color' },
    ])
  })

  it('treats a missing workflow as empty', () => {
    expect(signupLists(undefined)).toEqual({ observerSignups: [], producerSignups: [], casterSignups: [] })
  })
})

describe('withSignup', () => {
  it('adds the person to each ticked role once', () => {
    const lists = withSignup({ observerSignups: [5] }, 9, { observer: true, producer: true, caster: true, casterStyle: 'color' })
    expect(lists.observerSignups).toEqual([5, 9])
    expect(lists.producerSignups).toEqual([9])
    expect(lists.casterSignups).toEqual([{ user: 9, style: 'color' }])
  })

  it('is idempotent, so a repeated request does not double anyone', () => {
    const once = withSignup({}, 9, { observer: true, caster: true, casterStyle: 'both' })
    const twice = withSignup(once, 9, { observer: true, caster: true, casterStyle: 'both' })
    expect(twice).toEqual(once)
  })

  it('updates a caster style in place, keeping the row id', () => {
    const lists = withSignup({ casterSignups: [{ id: 'row1', user: 9, style: 'color' }] }, 9, { caster: true, casterStyle: 'both' })
    expect(lists.casterSignups).toEqual([{ id: 'row1', user: 9, style: 'both' }])
  })

  it('leaves unticked roles alone rather than removing them', () => {
    const lists = withSignup({ observerSignups: [9] }, 9, { producer: true })
    expect(lists.observerSignups).toEqual([9])
    expect(lists.producerSignups).toEqual([9])
  })
})

describe('withoutSignup', () => {
  it('removes every copy of the person from one role only', () => {
    const lists = withoutSignup({ observerSignups: [9, 5, 9], producerSignups: [9] }, 9, 'observer')
    expect(lists.observerSignups).toEqual([5])
    expect(lists.producerSignups).toEqual([9])
  })

  it('removes a caster row by person', () => {
    const lists = withoutSignup({ casterSignups: [{ id: 'x', user: 9 }, { id: 'y', user: 4 }] }, 9, 'caster')
    expect(lists.casterSignups).toEqual([{ id: 'y', user: 4 }])
  })
})

describe('withAssignment / withoutAssignment', () => {
  it('appends to the role list once', () => {
    expect(withAssignment({ assignedObservers: [{ id: 1 }] }, 'observer', 2)).toEqual({ assignedObservers: [1, 2] })
    expect(withAssignment({ assignedObservers: [1, 2] }, 'observer', 2)).toEqual({ assignedObservers: [1, 2] })
  })

  it('writes directors to their own list', () => {
    expect(withAssignment({}, 'director', 7)).toEqual({ assignedDirectors: [7] })
  })

  it('adds a caster with a style, defaulting to both', () => {
    expect(withAssignment({}, 'caster', 3)).toEqual({ assignedCasters: [{ user: 3, style: 'both' }] })
    expect(withAssignment({}, 'caster', 3, 'color')).toEqual({ assignedCasters: [{ user: 3, style: 'color' }] })
  })

  it('unassigns by person, not by position', () => {
    expect(withoutAssignment({ assignedCasters: [{ id: 'r1', user: 3 }, { id: 'r2', user: 4 }] }, 'caster', 3))
      .toEqual({ assignedCasters: [{ id: 'r2', user: 4 }] })
    expect(withoutAssignment({ assignedProducers: [1, 2] }, 'producer', 1)).toEqual({ assignedProducers: [2] })
  })
})

describe('slotSignups', () => {
  const joe = { id: 1324, name: 'Little Joe' }
  const metal = { id: 675, name: 'MetalOBS' }
  const j4 = { id: 1348, name: 'J4COB' }

  it('offers everyone who signed up for the time slot on every match in it', () => {
    const slot = slotSignups([
      { productionWorkflow: { observerSignups: [joe, metal], producerSignups: [metal] } },
      { productionWorkflow: { casterSignups: [{ user: j4, style: 'both' }] } },
      { productionWorkflow: { observerSignups: [joe, joe, metal, metal] } },
    ])
    expect(slot.observers).toEqual([joe, metal])
    expect(slot.producers).toEqual([metal])
    expect(slot.casters).toEqual([{ user: j4, style: 'both' }])
  })

  it('prefers a populated person over a bare id', () => {
    const slot = slotSignups<number | { id: number; name: string }>([
      { productionWorkflow: { observerSignups: [1324] } },
      { productionWorkflow: { observerSignups: [joe] } },
    ])
    expect(slot.observers).toEqual([joe])
  })

  it('keeps the first caster style it sees', () => {
    const slot = slotSignups([
      { productionWorkflow: { casterSignups: [{ user: j4, style: 'color' }] } },
      { productionWorkflow: { casterSignups: [{ user: j4, style: 'both' }] } },
    ])
    expect(slot.casters).toEqual([{ user: j4, style: 'color' }])
  })
})

describe('assignedElsewhere', () => {
  it('names the other match in the slot a person already works', () => {
    const busy = assignedElsewhere(
      [
        { id: 1, title: 'ELMT Stellar vs ThreeTwoOne', productionWorkflow: { assignedObservers: [{ id: 1324 }] } },
        { id: 2, title: 'ELMT Fire vs Moominhouse', productionWorkflow: { assignedCasters: [{ user: { id: 1348 } }] } },
      ],
      2,
    )
    expect(busy.get(1324)).toBe('ELMT Stellar vs ThreeTwoOne')
    // Their own match does not count as elsewhere
    expect(busy.has(1348)).toBe(false)
  })
})
