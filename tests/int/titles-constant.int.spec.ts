import { describe, it, expect } from 'vitest'
import {
  TITLES, TITLE_BY_VALUE, TITLE_VALUES, DEPARTMENT_KEYS, DEPARTMENT_FLAG, EXTRA_FLAGS, ROLE_VALUES,
  titleLabel, ORG_ROLES, ORG_ROLE_ORDER, ORG_ROLE_LABELS, ORG_ROLE_GROUP_LABELS, ORG_REGIONS,
} from '@/access/titles'

describe('TITLES constant', () => {
  it('has the 14 agreed titles in display order', () => {
    expect(TITLE_VALUES).toEqual([
      'owner', 'co-owner', 'administration', 'hr', 'region-lead',
      'event-manager', 'social-manager', 'marketing', 'graphics', 'media-editor',
      'caster', 'observer', 'producer', 'content-creator',
    ])
  })
  it('grants exactly the agreed departments', () => {
    const d = (v: keyof typeof TITLE_BY_VALUE) => TITLE_BY_VALUE[v].departments
    expect(d('event-manager')).toEqual(['events', 'pug'])
    expect(d('social-manager')).toEqual(['social'])
    expect(d('marketing')).toEqual(['social', 'graphics'])
    expect(d('graphics')).toEqual(['graphics'])
    expect(d('media-editor')).toEqual(['video'])
    for (const v of ['caster', 'observer', 'producer'] as const) expect(d(v)).toEqual(['production'])
    for (const v of ['owner', 'co-owner', 'administration', 'hr', 'region-lead', 'content-creator'] as const) expect(d(v)).toEqual([])
  })
  it('implies roles only for the four organization titles', () => {
    expect(TITLE_BY_VALUE.owner.impliesRole).toBe('admin')
    expect(TITLE_BY_VALUE['co-owner'].impliesRole).toBe('admin')
    expect(TITLE_BY_VALUE.administration.impliesRole).toBe('admin')
    expect(TITLE_BY_VALUE.hr.impliesRole).toBe('staff-manager')
    expect(TITLES.filter((t) => t.impliesRole).map((t) => t.value)).toEqual(['owner', 'co-owner', 'administration', 'hr'])
  })
  it('has lead labels only where agreed', () => {
    const leads = Object.fromEntries(TITLES.filter((t) => t.leadLabel).map((t) => [t.value, t.leadLabel]))
    expect(leads).toEqual({
      'event-manager': 'Events Lead',
      'social-manager': 'Social Media Lead',
      marketing: 'Marketing Lead',
      graphics: 'Graphics Lead',
      'media-editor': 'Media Editor Lead',
      caster: 'Lead Caster',
      producer: 'Lead Producer',
    })
  })
  it('renders lead labels', () => {
    expect(titleLabel({ title: 'caster', isLead: true })).toBe('Lead Caster')
    expect(titleLabel({ title: 'caster' })).toBe('Caster')
    expect(titleLabel({ title: 'observer', isLead: true })).toBe('Observer')
  })
  it('maps every department key to a departments.* flag', () => {
    expect(DEPARTMENT_KEYS).toEqual(['production', 'social', 'graphics', 'video', 'events', 'pug', 'scouting'])
    expect(DEPARTMENT_FLAG.pug).toBe('isPugAdmin')
    expect(EXTRA_FLAGS.map((f) => f.key)).toEqual([
      'isProductionStaff', 'isSocialMediaStaff', 'isGraphicsStaff', 'isVideoStaff', 'isEventsStaff', 'isScoutingStaff', 'isContentCreator', 'isPugAdmin', 'canUploadExternalScrims',
    ])
    expect(ROLE_VALUES).toEqual(['admin', 'staff-manager', 'user'])
  })
  it('keeps the old orgRoles exports for existing importers', () => {
    expect(ORG_ROLE_ORDER).toEqual(['owner', 'co-owner', 'administration', 'hr', 'region-lead', 'event-manager', 'social-manager', 'marketing', 'graphics', 'media-editor'])
    expect(ORG_ROLES.map((r) => r.value)).toEqual(ORG_ROLE_ORDER)
    expect(ORG_ROLE_LABELS['region-lead']).toBe('Region Lead')
    expect(ORG_ROLE_GROUP_LABELS.owner).toBeTruthy()
    expect(ORG_REGIONS.map((r) => r.value)).toEqual(['na', 'emea', 'sa', 'oce', 'apac', 'sea'])
  })
})
