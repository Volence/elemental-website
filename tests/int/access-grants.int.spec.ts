import { describe, it, expect } from 'vitest'
import { resolveAccess, canApplyPersonChange } from '@/access/resolve'

const noTeams: any[] = []
const admin = resolveAccess({ id: 1, role: 'admin' }, noTeams)
const staff = resolveAccess({ id: 2, role: 'staff-manager' }, noTeams)
const socialLead = resolveAccess({ id: 3, role: 'user', titles: [{ title: 'social-manager', isLead: true }] }, noTeams)
const marketingLead = resolveAccess({ id: 4, role: 'user', titles: [{ title: 'marketing', isLead: true }] }, noTeams)
const caster = resolveAccess({ id: 5, role: 'user', titles: [{ title: 'caster' }] }, noTeams)
const plain = resolveAccess({ id: 6, role: 'user' }, noTeams)

const before = { role: 'user', titles: [{ title: 'caster' as const }], departments: { isGraphicsStaff: false }, teamAccess: [] }

describe('canApplyPersonChange', () => {
  it('admin and staff-manager may change anything', () => {
    const after = { role: 'admin', titles: [{ title: 'owner' as const, isLead: false }], departments: { isGraphicsStaff: true }, teamAccess: [1] }
    expect(canApplyPersonChange(admin, before, after).ok).toBe(true)
    expect(canApplyPersonChange(staff, before, after).ok).toBe(true)
  })
  it('no change is always fine', () => {
    expect(canApplyPersonChange(plain, before, { ...before }).ok).toBe(true)
    expect(canApplyPersonChange(caster, before, { ...before, titles: [{ title: 'caster' }] }).ok).toBe(true)
  })
  it('a lead may add and remove member titles of their own department', () => {
    expect(canApplyPersonChange(socialLead, before, { ...before, titles: [{ title: 'caster' }, { title: 'social-manager' }] }).ok).toBe(true)
    expect(canApplyPersonChange(socialLead, { ...before, titles: [{ title: 'social-manager' }] }, { ...before, titles: [] }).ok).toBe(true)
  })
  it('a lead may toggle their own department flag only', () => {
    expect(canApplyPersonChange(socialLead, before, { ...before, departments: { isSocialMediaStaff: true } }).ok).toBe(true)
    const r = canApplyPersonChange(socialLead, before, { ...before, departments: { isGraphicsStaff: true } })
    expect(r.ok).toBe(false)
  })
  it('a lead of two departments (marketing) may grant either', () => {
    expect(canApplyPersonChange(marketingLead, before, { ...before, titles: [{ title: 'caster' }, { title: 'graphics' }] }).ok).toBe(true)
    expect(canApplyPersonChange(marketingLead, before, { ...before, departments: { isSocialMediaStaff: true } }).ok).toBe(true)
  })
  it('a lead may not add a title outside their department, nor one that spans another department', () => {
    expect(canApplyPersonChange(socialLead, before, { ...before, titles: [{ title: 'caster' }, { title: 'graphics' }] }).ok).toBe(false)
    // marketing grants social AND graphics; a social-only lead cannot grant it
    expect(canApplyPersonChange(socialLead, before, { ...before, titles: [{ title: 'caster' }, { title: 'marketing' }] }).ok).toBe(false)
  })
  it('a lead may not set lead flags, regions, roles, role-implying titles, or team access', () => {
    expect(canApplyPersonChange(socialLead, before, { ...before, titles: [{ title: 'caster' }, { title: 'social-manager', isLead: true }] }).ok).toBe(false)
    expect(canApplyPersonChange(socialLead, before, { ...before, role: 'staff-manager' }).ok).toBe(false)
    expect(canApplyPersonChange(socialLead, before, { ...before, titles: [{ title: 'caster' }, { title: 'hr' }] }).ok).toBe(false)
    expect(canApplyPersonChange(socialLead, before, { ...before, titles: [{ title: 'caster' }, { title: 'region-lead', regions: ['na'] }] }).ok).toBe(false)
    expect(canApplyPersonChange(socialLead, before, { ...before, teamAccess: [1] }).ok).toBe(false)
  })
  it('a member or plain user may change nothing', () => {
    expect(canApplyPersonChange(caster, before, { ...before, titles: [{ title: 'caster' }, { title: 'observer' }] }).ok).toBe(false)
    expect(canApplyPersonChange(plain, before, { ...before, departments: { isGraphicsStaff: true } }).ok).toBe(false)
  })
  it('reordering titles is not a change', () => {
    const b = { ...before, titles: [{ title: 'caster' as const }, { title: 'observer' as const }] }
    const a = { ...before, titles: [{ title: 'observer' as const }, { title: 'caster' as const }] }
    expect(canApplyPersonChange(plain, b, a).ok).toBe(true)
  })
  it('an omitted field on `after` means unchanged, not emptied', () => {
    const beforeWithOwner = { ...before, titles: [{ title: 'owner' as const }] }
    expect(canApplyPersonChange(socialLead, beforeWithOwner, { ...beforeWithOwner, titles: undefined }).ok).toBe(true)
    expect(canApplyPersonChange(socialLead, before, { ...before, departments: undefined }).ok).toBe(true)
    // an explicit empty titles array, unlike an omitted one, is a real change and still rejected
    // when it removes a role-implying title.
    expect(canApplyPersonChange(socialLead, beforeWithOwner, { ...beforeWithOwner, titles: [] }).ok).toBe(false)
  })
  it('a department lead may not assign a title with no department, such as Content Creator', () => {
    const r = canApplyPersonChange(marketingLead, before, { ...before, titles: [{ title: 'caster' }, { title: 'content-creator' }] })
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.reason).toBe('Only staff managers and admins can assign Content Creator')
  })
})
