import { describe, it, expect } from 'vitest'
import { DEPARTMENT_KEYS, DEPARTMENT_LABELS, ROLE_VALUES } from '@/accessReview/types'

describe('access review constants', () => {
  it('lists the eight department flags from the People collection', () => {
    expect(DEPARTMENT_KEYS).toEqual([
      'isProductionStaff',
      'isSocialMediaStaff',
      'isGraphicsStaff',
      'isVideoStaff',
      'isEventsStaff',
      'isScoutingStaff',
      'isContentCreator',
      'isPugAdmin',
    ])
  })

  it('labels every department key', () => {
    for (const key of DEPARTMENT_KEYS) {
      expect(typeof DEPARTMENT_LABELS[key]).toBe('string')
      expect(DEPARTMENT_LABELS[key].length).toBeGreaterThan(0)
    }
  })

  it('lists the five person roles', () => {
    expect(ROLE_VALUES).toEqual(['admin', 'staff-manager', 'team-manager', 'player', 'user'])
  })
})
