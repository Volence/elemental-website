/**
 * Shared workboard vocabulary. Previously copied into KanbanBoard, TaskCard,
 * TaskModal and KanbanColumn separately (and drifting).
 */

import { DEPARTMENT_FLAG, titlesGranting, type DepartmentKey } from '@/access/titles'

export const DEPT_NAMES: Record<string, string> = {
  graphics: 'Graphics',
  video: 'Video',
  events: 'Events',
  scouting: 'Scouting',
  production: 'Production',
  'social-media': 'Social Media',
}

/** Tasks' `department` values mapped to the access DepartmentKey (only 'social-media' differs). */
export const DEPT_ACCESS_KEY: Record<string, DepartmentKey> = {
  graphics: 'graphics',
  video: 'video',
  events: 'events',
  scouting: 'scouting',
  production: 'production',
  'social-media': 'social',
}

/**
 * Query string selecting the people in a department: the extra-access flag OR any title that
 * grants the department. Titles alone are enough - a Social Media Lead holds the department
 * through the title and has no isSocialMediaStaff flag ticked, and filtering on the flag alone
 * kept them (and everyone like them) out of their own board's assignee list. Admins and staff
 * managers resolve to lead everywhere but are deliberately not listed here; they show up only
 * when they hold a title or flag for the department.
 */
export function assignablePeopleQuery(taskDepartment: string): string {
  const key = DEPT_ACCESS_KEY[taskDepartment]
  if (!key) return ''
  const titles = titlesGranting(key)
  const clauses = [`where[or][0][departments.${DEPARTMENT_FLAG[key]}][equals]=true`]
  if (titles.length > 0) clauses.push(`where[or][1][titles.title][in]=${titles.join(',')}`)
  return clauses.join('&')
}

export const STATUS_OPTIONS = [
  { label: 'Backlog', value: 'backlog' },
  { label: 'In Progress', value: 'in-progress' },
  { label: 'Review', value: 'review' },
  { label: 'Complete', value: 'complete' },
] as const

export const PRIORITY_OPTIONS = [
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'High', value: 'high' },
  { label: 'Urgent', value: 'urgent' },
] as const

export const PRIORITY_LABELS: Record<string, string> = Object.fromEntries(PRIORITY_OPTIONS.map((p) => [p.value, p.label]))

/** Higher rank = more urgent. */
export const PRIORITY_RANK: Record<string, number> = { low: 0, medium: 1, high: 2, urgent: 3 }

/**
 * Board priority filter values. "high+" means high or urgent; "medium+" means
 * everything except low. The old filter said "High+" but matched exactly high.
 */
export type PriorityFilter = 'all' | 'urgent' | 'high+' | 'medium+'

export const PRIORITY_FILTER_OPTIONS: { value: PriorityFilter; label: string }[] = [
  { value: 'all', label: 'All priorities' },
  { value: 'urgent', label: 'Urgent only' },
  { value: 'high+', label: 'High and urgent' },
  { value: 'medium+', label: 'Medium and above' },
]

export function priorityFilterMatches(filter: PriorityFilter | string, priority: string | null | undefined): boolean {
  const rank = PRIORITY_RANK[priority || 'medium'] ?? 1
  switch (filter) {
    case 'urgent':
      return rank >= 3
    case 'high+':
      return rank >= 2
    case 'medium+':
      return rank >= 1
    default:
      return true
  }
}

/** Which departments each department may raise requests to. */
export const REQUEST_MATRIX: Record<string, string[]> = {
  'social-media': ['graphics', 'video'],
  events: ['social-media', 'graphics', 'video'],
  video: ['graphics', 'social-media'],
  graphics: ['social-media'],
  production: ['graphics', 'video'],
}
