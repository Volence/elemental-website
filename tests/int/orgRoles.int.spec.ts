import { describe, it, expect } from 'vitest'
import { ORG_ROLES, ORG_ROLE_ORDER, ORG_ROLE_LABELS } from '@/utilities/orgRoles'

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
