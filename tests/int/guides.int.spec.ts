import { describe, it, expect } from 'vitest'
import { guideMatchesViewer, toggleSectionDone, sectionsDone } from '@/guides/audience'
import { parseBlocks, parseInlines } from '@/guides/markdown'
import { resolveAccess } from '@/access/resolve'

// guideMatchesViewer takes the same ResolvedAccess every other permission decision uses, not a
// raw role string - team-manager/player are no longer People.role values (role collapsed to
// three: admin, staff-manager, user), so these audiences are read off access.teamIds/canManagePeople.
describe('guideMatchesViewer', () => {
  const teamAccessPerson = resolveAccess({ id: 1, role: 'user', teamAccess: [3] }, [])
  const plainUser = resolveAccess({ id: 2, role: 'user' }, [])
  const social = resolveAccess({ id: 3, role: 'user', departments: { isSocialMediaStaff: true } }, [])
  const admin = resolveAccess({ id: 4, role: 'admin' }, [])

  it('a team-access person matches the team-manager audience, not the player one', () => {
    expect(guideMatchesViewer({ roles: { teamManager: true } }, teamAccessPerson)).toBe(true)
    expect(guideMatchesViewer({ roles: { player: true } }, teamAccessPerson)).toBe(false)
  })

  it('a plain user matches the player audience, not the team-manager one', () => {
    expect(guideMatchesViewer({ roles: { player: true } }, plainUser)).toBe(true)
    expect(guideMatchesViewer({ roles: { teamManager: true } }, plainUser)).toBe(false)
  })

  it('an admin matches admin-audience guides, and every other audience too', () => {
    expect(guideMatchesViewer({ roles: { admin: true } }, admin)).toBe(true)
    expect(guideMatchesViewer({ roles: { player: true } }, admin)).toBe(true)
  })

  it('matches by department and everyone', () => {
    expect(guideMatchesViewer({ departments: { socialMedia: true } }, social)).toBe(true)
    expect(guideMatchesViewer({ departments: { graphics: true } }, social)).toBe(false)
    expect(guideMatchesViewer({ everyone: true }, social)).toBe(true)
  })

  it('returns false with no audience or no access', () => {
    expect(guideMatchesViewer(null, teamAccessPerson)).toBe(false)
    expect(guideMatchesViewer({ everyone: true }, null)).toBe(false)
  })
})

describe('guide progress', () => {
  it('ticks and unticks sections per guide', () => {
    let p = toggleSectionDone(null, 'team-manager', 'a', true)
    p = toggleSectionDone(p, 'team-manager', 'b', true)
    p = toggleSectionDone(p, 'player', 'x', true)
    expect([...sectionsDone(p, 'team-manager')].sort()).toEqual(['a', 'b'])
    p = toggleSectionDone(p, 'team-manager', 'a', false)
    expect([...sectionsDone(p, 'team-manager')]).toEqual(['b'])
    expect([...sectionsDone(p, 'player')]).toEqual(['x'])
  })
})

describe('guide markdown', () => {
  it('parses bold, code and links inline', () => {
    expect(parseInlines('Open **Build**, press `Save`, see [docs](/admin/guides).')).toEqual([
      { type: 'text', text: 'Open ' }, { type: 'bold', text: 'Build' }, { type: 'text', text: ', press ' },
      { type: 'code', text: 'Save' }, { type: 'text', text: ', see ' }, { type: 'link', text: 'docs', href: '/admin/guides' }, { type: 'text', text: '.' },
    ])
  })
  it('splits paragraphs and lists', () => {
    const blocks = parseBlocks('Intro line\nstill intro\n\n- one\n- two\n\n1. first\n2. second\nAfter')
    expect(blocks.map(b => b.type)).toEqual(['paragraph', 'list', 'list', 'paragraph'])
    expect((blocks[1] as any).ordered).toBe(false)
    expect((blocks[2] as any).ordered).toBe(true)
    expect((blocks[2] as any).items).toHaveLength(2)
    expect((blocks[0] as any).inlines[0].text).toBe('Intro line still intro')
  })
})
