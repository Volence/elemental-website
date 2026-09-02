import { describe, it, expect } from 'vitest'
import { buildWeeklyDigest, chunkMessage, type DigestTask } from '@/utilities/socialMediaDigest'

const start = new Date(2026, 7, 31) // Mon Aug 31 2026
const end = new Date(2026, 8, 6) // Sun Sep 6 2026

const tasks: DigestTask[] = [
  {
    title: 'Cointree Seminar Post',
    dueDate: '2026-08-31T00:00:00.000Z',
    status: 'complete',
    assignees: [{ name: 'Tycho', discordId: '111111111111111111' }],
  },
  {
    title: 'Tycho welcome Post',
    dueDate: '2026-09-01T00:00:00.000Z',
    status: 'complete',
    assignees: [{ name: 'yuki', discordId: '222222222222222222' }],
  },
  {
    title: 'Showmatch Post NA & interview Post',
    dueDate: '2026-09-02T00:00:00.000Z',
    status: 'backlog',
    assignees: [{ name: 'Tycho', discordId: '111111111111111111' }],
  },
  {
    title: 'Content Post',
    dueDate: '2026-09-05T00:00:00.000Z',
    status: 'backlog',
    assignees: [{ name: 'Luxior Chango', discordId: null }],
  },
  {
    title: 'Content Post',
    dueDate: '2026-09-06T00:00:00.000Z',
    status: 'in-progress',
    assignees: [],
  },
]

describe('buildWeeklyDigest', () => {
  it('renders the week header with a role mention when configured', () => {
    const text = buildWeeklyDigest({ start, end, tasks, roleId: '999999999999999999' })
    expect(text.split('\n')[0]).toBe('**Week from 08.31 - 09.06** <@&999999999999999999>')
  })

  it('omits the role mention when none is configured', () => {
    const text = buildWeeklyDigest({ start, end, tasks })
    expect(text.split('\n')[0]).toBe('**Week from 08.31 - 09.06**')
  })

  it('lists one bullet per task in date order with a check mark for complete tasks', () => {
    const text = buildWeeklyDigest({ start, end, tasks })
    expect(text).toContain('- **08.31: Cointree Seminar Post** ✅\n - <@111111111111111111>')
    expect(text).toContain('- **09.02: Showmatch Post NA & interview Post**\n - <@111111111111111111>')
    expect(text.indexOf('08.31')).toBeLessThan(text.indexOf('09.01'))
    expect(text.indexOf('09.01')).toBeLessThan(text.indexOf('09.02'))
  })

  it('falls back to the display name when an assignee has no Discord ID', () => {
    const text = buildWeeklyDigest({ start, end, tasks })
    expect(text).toContain('- **09.05: Content Post**\n - Luxior Chango')
  })

  it('marks tasks with no assignee as unassigned', () => {
    const text = buildWeeklyDigest({ start, end, tasks })
    expect(text).toContain('- **09.06: Content Post**\n - _unassigned_')
  })

  it('ignores tasks outside the range and tasks without a due date', () => {
    const text = buildWeeklyDigest({
      start,
      end,
      tasks: [
        ...tasks,
        { title: 'Old thing', dueDate: '2026-08-01T00:00:00.000Z', status: 'backlog', assignees: [] },
        { title: 'Undated', dueDate: null, status: 'backlog', assignees: [] },
      ],
    })
    expect(text).not.toContain('Old thing')
    expect(text).not.toContain('Undated')
  })

  it('says so when the week is empty', () => {
    const text = buildWeeklyDigest({ start, end, tasks: [] })
    expect(text).toContain('_No posts scheduled this week._')
  })

  it('appends an optional footer', () => {
    const text = buildWeeklyDigest({ start, end, tasks, footer: 'Thanks!' })
    expect(text.trimEnd().endsWith('Thanks!')).toBe(true)
  })
})

describe('chunkMessage', () => {
  it('returns the whole message when it fits', () => {
    expect(chunkMessage('hello', 10)).toEqual(['hello'])
  })

  it('splits on blank lines without breaking a block', () => {
    const blocks = ['aaaa', 'bbbb', 'cccc', 'dddd']
    const text = blocks.join('\n\n')
    expect(chunkMessage(text, 11)).toEqual(['aaaa\n\nbbbb', 'cccc\n\ndddd'])
  })

  it('keeps every bullet of a real digest', () => {
    const text = buildWeeklyDigest({ start, end, tasks })
    const rejoined = chunkMessage(text, 120).join('\n\n')
    expect(rejoined).toBe(text.trimEnd())
  })
})
