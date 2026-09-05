import { describe, it, expect } from 'vitest'
import { guideMatchesViewer, toggleSectionDone, sectionsDone } from '@/guides/audience'
import { parseBlocks, parseInlines } from '@/guides/markdown'

describe('guideMatchesViewer', () => {
  const manager = { role: 'team-manager', departments: {} }
  const social = { role: 'user', departments: { isSocialMediaStaff: true } }
  it('matches by role, department, everyone, and admins see all', () => {
    expect(guideMatchesViewer({ roles: { teamManager: true } }, manager)).toBe(true)
    expect(guideMatchesViewer({ roles: { player: true } }, manager)).toBe(false)
    expect(guideMatchesViewer({ departments: { socialMedia: true } }, social)).toBe(true)
    expect(guideMatchesViewer({ departments: { graphics: true } }, social)).toBe(false)
    expect(guideMatchesViewer({ everyone: true }, social)).toBe(true)
    expect(guideMatchesViewer({ roles: { player: true } }, { role: 'admin' })).toBe(true)
    expect(guideMatchesViewer(null, manager)).toBe(false)
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
