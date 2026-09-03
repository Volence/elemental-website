import { describe, it, expect } from 'vitest'
import { departmentsFor, greeting, isOverdue, mergeUpcoming } from '@/components/BeforeDashboard/summary'

describe('departmentsFor', () => {
  it('managers see every department queue', () => {
    expect(departmentsFor('admin', null)).toHaveLength(6)
    expect(departmentsFor('staff-manager', { isGraphicsStaff: true })).toHaveLength(6)
  })
  it('staff see only the departments they are flagged for', () => {
    expect(departmentsFor('team-manager', { isProductionStaff: true, isEventsStaff: true, isVideoStaff: false })).toEqual(['production', 'events'])
    expect(departmentsFor('player', null)).toEqual([])
  })
})

describe('greeting', () => {
  it('follows the viewer clock and uses the name when known', () => {
    expect(greeting(8, 'Sam')).toBe('Good morning, Sam')
    expect(greeting(14, null)).toBe('Good afternoon')
    expect(greeting(21, 'Sam')).toBe('Good evening, Sam')
    expect(greeting(2, 'Sam')).toBe('Up late, Sam')
    expect(greeting(null, 'Sam')).toBe('Welcome back, Sam')
  })
})

describe('mergeUpcoming', () => {
  it('interleaves matches and events by date and caps the list', () => {
    const items = mergeUpcoming(
      [
        { id: 1, title: 'ELMT Fire vs Ice', date: '2026-09-05T20:00:00Z', league: 'FACEIT', region: 'NA', status: 'scheduled' },
        { id: 2, title: 'ELMT Water vs Air', date: '2026-09-03T20:00:00Z', league: null, region: null, status: 'scheduled' },
      ],
      [{ id: 9, title: 'Community night', date: '2026-09-04T18:00:00Z', eventType: 'community', region: 'EMEA' }],
      2,
    )
    expect(items.map((i) => `${i.kind}:${i.id}`)).toEqual(['match:2', 'event:9'])
    expect(items[0].subtitle).toBe('Match')
    expect(items[1].subtitle).toBe('community · EMEA')
  })
})

describe('isOverdue', () => {
  const now = new Date('2026-09-03T12:00:00Z').getTime()
  it('is true only for open tasks with a past due date', () => {
    expect(isOverdue({ dueDate: '2026-09-01T00:00:00Z', status: 'backlog' }, now)).toBe(true)
    expect(isOverdue({ dueDate: '2026-09-01T00:00:00Z', status: 'complete' }, now)).toBe(false)
    expect(isOverdue({ dueDate: '2026-09-09T00:00:00Z', status: 'in-progress' }, now)).toBe(false)
    expect(isOverdue({ dueDate: null, status: 'backlog' }, now)).toBe(false)
  })
})
