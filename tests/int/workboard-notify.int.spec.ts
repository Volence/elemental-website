import { describe, it, expect } from 'vitest'
import { buildRequestCreatedMessage, buildRequestCompletedMessage, taskBoardUrl } from '@/discord/services/workboardNotify'

describe('workboard request messages', () => {
  const task = {
    id: 42,
    title: 'Showmatch banner',
    department: 'graphics',
    isRequest: true,
    requestedByDepartment: 'social-media',
    dueDate: '2026-09-10T00:00:00.000Z',
    priority: 'high',
  }

  it('deep-links to the owning board with ?task=', () => {
    expect(taskBoardUrl(task)).toMatch(/\/admin\/collections\/graphics-anchor\?task=42$/)
    expect(taskBoardUrl({ ...task, department: 'production' })).toMatch(/production-dashboard\?tab=workboard&task=42$/)
    expect(taskBoardUrl({ ...task, department: null })).toMatch(/\/admin\/collections\/tasks\/42$/)
  })

  it('describes who asked whom, with due date and non-default priority', () => {
    const msg = buildRequestCreatedMessage(task)
    expect(msg).toContain('New request from **Social Media** for Graphics')
    expect(msg).toContain('**Showmatch banner**')
    expect(msg).toContain('Due Sep 10')
    expect(msg).toContain('Priority: high')
  })

  it('completion message goes back to the requester with the board link', () => {
    const msg = buildRequestCompletedMessage(task)
    expect(msg).toContain('**Graphics** completed your request')
    expect(msg).toContain('?task=42')
  })
})
