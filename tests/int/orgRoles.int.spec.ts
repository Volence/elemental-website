import { describe, it, expect } from 'vitest'
import {
  ORG_ROLES,
  ORG_ROLE_ORDER,
  ORG_ROLE_LABELS,
  ORG_ROLE_GROUP_LABELS,
} from '@/utilities/orgRoles'
import { getStaffDepartmentColor, getStaffRoleIcon } from '@/discord/utils/embeds'

describe('orgRoles', () => {
  it('has the canonical 10 roles in hierarchy order', () => {
    expect(ORG_ROLE_ORDER).toEqual([
      'owner',
      'co-owner',
      'administration',
      'hr',
      'region-lead',
      'event-manager',
      'social-manager',
      'marketing',
      'graphics',
      'media-editor',
    ])
  })

  it('does not contain the retired moderator role', () => {
    expect(ORG_ROLE_ORDER).not.toContain('moderator')
  })

  it('maps every slug to a display label', () => {
    expect(ORG_ROLE_LABELS['administration']).toBe('Administration')
    expect(ORG_ROLE_LABELS['marketing']).toBe('Marketing')
    expect(ORG_ROLE_LABELS['region-lead']).toBe('Region Lead')
    expect(ORG_ROLE_LABELS['hr']).toBe('HR')
    for (const r of ORG_ROLES) {
      expect(ORG_ROLE_LABELS[r.value]).toBe(r.label)
    }
  })
})

describe('org role group labels', () => {
  it('every role has a group label', () => {
    for (const r of ORG_ROLES) {
      expect(ORG_ROLE_GROUP_LABELS[r.value]).toBe(r.groupLabel)
      expect(r.groupLabel.length).toBeGreaterThan(0)
    }
  })

  it('every group label has a dedicated Discord embed color and icon', () => {
    const DEFAULT_COLOR = 0x9b59b6
    for (const r of ORG_ROLES) {
      expect(getStaffDepartmentColor(r.groupLabel), `color for ${r.groupLabel}`).not.toBe(
        DEFAULT_COLOR,
      )
      expect(getStaffRoleIcon(r.groupLabel), `icon for ${r.groupLabel}`).toBeTruthy()
    }
  })
})
