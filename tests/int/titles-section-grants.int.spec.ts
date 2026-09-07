import { describe, it, expect } from 'vitest'
import { resolveAccess } from '@/access/resolve'
import { TITLES } from '@/access/titles'
import { grantableTitles, canRemoveEntry } from '@/components/PersonEditor/TitlesSection'

const noTeams: any[] = []
const admin = resolveAccess({ id: 1, role: 'admin' }, noTeams)
const socialLead = resolveAccess({ id: 2, role: 'user', titles: [{ title: 'social-manager', isLead: true }] }, noTeams)
const marketingLead = resolveAccess({ id: 3, role: 'user', titles: [{ title: 'marketing', isLead: true }] }, noTeams)
const eventsLead = resolveAccess({ id: 5, role: 'user', titles: [{ title: 'event-manager', isLead: true }] }, noTeams)
const plain = resolveAccess({ id: 4, role: 'user' }, noTeams)

describe('grantableTitles', () => {
  it('null actor gets nothing', () => {
    expect(grantableTitles(null)).toEqual([])
  })

  it('admin (staff) gets every title', () => {
    expect(grantableTitles(admin)).toEqual(TITLES.map((t) => t.value))
    expect(grantableTitles(admin)).toHaveLength(15)
  })

  it('a social lead gets only social-manager', () => {
    expect(grantableTitles(socialLead)).toEqual(['social-manager'])
  })

  it('a lead of two departments gets every title inside both', () => {
    expect(grantableTitles(eventsLead)).toEqual(['event-manager'])
  })

  it('a Marketing Lead leads no department, so gets nothing', () => {
    expect(grantableTitles(marketingLead)).toEqual([])
  })

  it('a plain member with no lead departments gets nothing', () => {
    expect(grantableTitles(plain)).toEqual([])
  })
})

describe('canRemoveEntry', () => {
  it('a lead cannot remove their own lead-flagged entry - only staff can touch isLead', () => {
    expect(canRemoveEntry(socialLead, { title: 'social-manager', isLead: true })).toBe(false)
  })

  it('a lead can remove a non-lead entry within their own department', () => {
    expect(canRemoveEntry(socialLead, { title: 'social-manager', isLead: false })).toBe(true)
  })

  it('staff can remove a lead-flagged entry', () => {
    expect(canRemoveEntry(admin, { title: 'social-manager', isLead: true })).toBe(true)
  })

  it('an entry outside the actor\'s grantable set is never removable, lead flag or not', () => {
    expect(canRemoveEntry(socialLead, { title: 'graphics', isLead: false })).toBe(false)
  })

  it('null actor cannot remove anything', () => {
    expect(canRemoveEntry(null, { title: 'social-manager', isLead: false })).toBe(false)
  })
})
